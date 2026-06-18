"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { encryptSecret, decryptSecret } from "@/lib/crypto"
import {
  parseFigmaUrl,
  figmaGetMe,
  figmaGetImages,
  collectImportPlan,
  type ImportScreen,
} from "@/lib/figma"

async function requireUser() {
  const session = await auth()
  if (!session) redirect("/login")
  return session.user.id
}

async function getOwnedEditableStudy(studyId: string) {
  const userId = await requireUser()
  const study = await prisma.study.findUnique({
    where: { id: studyId, ownerId: userId },
    include: { prototype: { include: { screens: true } } },
  })
  if (!study) throw new Error("Study não encontrado")
  if (study.status === "live") throw new Error("Encerre o estudo para editá-lo.")
  return { study, userId }
}

async function getDecryptedToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { figmaAccessToken: true },
  })
  if (!user?.figmaAccessToken) throw new Error("Figma não conectado.")
  return decryptSecret(user.figmaAccessToken)
}

// ── Conexão / token (por usuário) ──────────────────────────────────────────
export async function getFigmaConnectionAction(): Promise<{ connected: boolean }> {
  const userId = await requireUser()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { figmaAccessToken: true },
  })
  return { connected: !!user?.figmaAccessToken }
}

export async function saveFigmaTokenAction(token: string): Promise<{ handle: string }> {
  const userId = await requireUser()
  const clean = token.trim()
  if (!clean) throw new Error("Token vazio.")
  const me = await figmaGetMe(clean) // valida o token (lança se inválido)
  await prisma.user.update({
    where: { id: userId },
    data: { figmaAccessToken: encryptSecret(clean) },
  })
  return { handle: me.handle }
}

export async function disconnectFigmaAction(): Promise<void> {
  const userId = await requireUser()
  await prisma.user.update({ where: { id: userId }, data: { figmaAccessToken: null } })
}

// ── Inspeção (etapa de revisão) ─────────────────────────────────────────────
export async function figmaInspectAction(
  studyId: string,
  url: string
): Promise<{ fileKey: string; screens: ImportScreen[] }> {
  const { userId } = await getOwnedEditableStudy(studyId)
  const token = await getDecryptedToken(userId)
  const { fileKey, nodeId } = parseFigmaUrl(url)
  const screens = await collectImportPlan(token, fileKey, nodeId)
  if (!screens.length) {
    throw new Error("Nenhuma tela com protótipo encontrada nesse link.")
  }
  // miniaturas para a revisão
  const thumbs = await figmaGetImages(
    token,
    fileKey,
    screens.map((s) => s.figmaId),
    { scale: 1, format: "png" }
  )
  for (const s of screens) s.thumbUrl = thumbs[s.figmaId]
  return { fileKey, screens }
}

// ── Importação ──────────────────────────────────────────────────────────────
async function downloadAndUpload(
  studyId: string,
  figmaUrl: string,
  index: number
): Promise<string> {
  const res = await fetch(figmaUrl, { cache: "no-store" })
  if (!res.ok) throw new Error(`Falha ao baixar imagem do Figma (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const path = `${studyId}/figma/${Date.now()}-${index}.png`
  const { error } = await supabase.storage
    .from("screens")
    .upload(path, buffer, { contentType: "image/png", upsert: false })
  if (error) throw new Error(`Upload falhou: ${error.message}`)
  return supabase.storage.from("screens").getPublicUrl(path).data.publicUrl
}

export async function figmaImportAction(
  studyId: string,
  fileKey: string,
  selected: ImportScreen[]
): Promise<{ screens: number; hotspots: number }> {
  const { study, userId } = await getOwnedEditableStudy(studyId)
  if (!selected.length) throw new Error("Nenhuma tela selecionada.")
  const token = await getDecryptedToken(userId)

  // ordena: tela inicial primeiro (se houver)
  const screens = [...selected].sort((a, b) => Number(b.isStart) - Number(a.isStart))

  // 1) exporta as imagens em alta (scale 2) e re-hospeda no Supabase
  const exportUrls = await figmaGetImages(
    token,
    fileKey,
    screens.map((s) => s.figmaId),
    { scale: 2, format: "png" }
  )
  const publicUrls: Record<string, string> = {}
  // baixa/sobe em lotes para não estourar tempo nem memória
  for (let i = 0; i < screens.length; i += 4) {
    const batch = screens.slice(i, i + 4)
    await Promise.all(
      batch.map(async (s, j) => {
        const src = exportUrls[s.figmaId]
        if (!src) throw new Error(`Figma não exportou a tela "${s.name}".`)
        publicUrls[s.figmaId] = await downloadAndUpload(studyId, src, i + j)
      })
    )
  }

  // 2) prototype (reusa o existente ou cria como figma)
  const proto =
    study.prototype ??
    (await prisma.prototype.create({
      data: { studyId: study.id, source: "figma", figmaFileKey: fileKey },
    }))
  if (study.prototype) {
    await prisma.prototype.update({
      where: { id: proto.id },
      data: { source: "figma", figmaFileKey: fileKey },
    })
  }
  const startOrder =
    study.prototype?.screens.length
      ? Math.max(...study.prototype.screens.map((s) => s.order)) + 1
      : 0

  // 3) cria as telas e monta o mapa figmaId → screenId
  const idMap: Record<string, string> = {}
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i]
    const created = await prisma.screen.create({
      data: {
        prototypeId: proto.id,
        name: s.name,
        order: startOrder + i,
        imageUrl: publicUrls[s.figmaId],
        width: s.width || 360,
        height: s.height || 800,
        scroll: s.scroll,
      },
    })
    idMap[s.figmaId] = created.id
  }

  // 4) hotspots (resolve destino via idMap) + regiões
  let hotspotCount = 0
  for (const s of screens) {
    const screenId = idMap[s.figmaId]
    for (const h of s.hotspots) {
      const needsTarget = h.action === "navigate" || h.action === "open_overlay"
      const targetScreenId = h.destFigmaId ? idMap[h.destFigmaId] ?? null : null
      if (needsTarget && !targetScreenId) continue // destino fora da seleção
      await prisma.hotspot.create({
        data: {
          screenId,
          shape: "rect",
          coords: h.coords,
          action: h.action,
          overlayPosition: h.action === "open_overlay" ? h.overlayPosition ?? "bottom" : null,
          targetScreenId,
        },
      })
      hotspotCount++
    }
    for (const r of s.regions) {
      await prisma.scrollRegion.create({
        data: {
          screenId,
          kind: r.kind,
          coords: r.coords,
          axis: r.axis,
          imageUrl: null, // fixed reaproveita a tela; scroll: usuário anexa a tira depois
        },
      })
    }
  }

  revalidatePath(`/studies/${studyId}`)
  return { screens: screens.length, hotspots: hotspotCount }
}
