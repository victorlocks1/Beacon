"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase, removeStorageByUrls } from "@/lib/supabase"
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
  if (!session?.user?.id) redirect("/login")
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
// Erros de controle de fluxo do Next (redirect/notFound) precisam propagar.
function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown })?.digest
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
}

type InspectResult =
  | { ok: true; fileKey: string; nodeId: string | null; screens: ImportScreen[] }
  | { ok: false; error: string }

export async function figmaInspectAction(studyId: string, url: string): Promise<InspectResult> {
  try {
    const { userId } = await getOwnedEditableStudy(studyId)
    const token = await getDecryptedToken(userId)
    const { fileKey, nodeId } = parseFigmaUrl(url)
    const screens = await collectImportPlan(token, fileKey, nodeId)
    if (!screens.length) {
      return { ok: false, error: "Nenhuma tela com protótipo encontrada nesse link." }
    }
    // miniaturas para a revisão — opcional. Se o Figma limitar (429) só nas
    // imagens, seguimos sem preview em vez de travar todo o inspecionar.
    try {
      const thumbs = await figmaGetImages(
        token,
        fileKey,
        screens.map((s) => s.figmaId),
        { scale: 1, format: "png" }
      )
      for (const s of screens) s.thumbUrl = thumbs[s.figmaId]
    } catch {
      /* sem miniaturas desta vez */
    }
    return { ok: true, fileKey, nodeId, screens }
  } catch (e) {
    if (isNextControlFlow(e)) throw e
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao ler o protótipo." }
  }
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

// Exporta as PEÇAS do conteúdo rolável (carrossel/tira) de cada frame com scroll
// e injeta as urls públicas nas `pieces` de `scrollFrames`. É isso que permite
// desenhar a "tira desenrolada" e o heatmap do conteúdo escondido nos resultados.
// Falha silenciosa (rate limit etc.) — sem tira, o resto do import segue normal.
async function exportScrollStrips(
  studyId: string,
  token: string,
  fileKey: string,
  screens: ImportScreen[]
): Promise<void> {
  try {
    const ids = [
      ...new Set(
        screens.flatMap((s) =>
          (s.scrollFrames ?? []).flatMap((f) => (f.pieces ?? []).map((p) => p.figmaId))
        )
      ),
    ]
    if (!ids.length) return
    const exported = await figmaGetImages(token, fileKey, ids, { scale: 2, format: "png" })
    const urls: Record<string, string> = {}
    for (let i = 0; i < ids.length; i += 4) {
      const batch = ids.slice(i, i + 4)
      await Promise.all(
        batch.map(async (id, j) => {
          const src = exported[id]
          if (src) urls[id] = await downloadAndUpload(studyId, src, 20000 + i + j)
        })
      )
    }
    for (const s of screens)
      for (const f of s.scrollFrames ?? [])
        for (const p of f.pieces ?? []) if (urls[p.figmaId]) p.url = urls[p.figmaId]
  } catch {
    /* sem tiras desta vez — não quebra o import */
  }
}

type ImportResult =
  | { ok: true; screens: number; hotspots: number }
  | { ok: false; error: string }

export async function figmaImportAction(
  studyId: string,
  fileKey: string,
  selected: ImportScreen[]
): Promise<ImportResult> {
  try {
    const r = await figmaImportImpl(studyId, fileKey, selected)
    return { ok: true, ...r }
  } catch (e) {
    if (isNextControlFlow(e)) throw e
    return { ok: false, error: e instanceof Error ? e.message : "Falha na importação." }
  }
}

// Import LEVE (modo ao vivo): grava só o mapa de frames (node-id, nome, tamanho)
// a partir dos dados JÁ inspecionados. NÃO baixa imagem nem hotspots → nenhuma
// chamada ao endpoint de imagens do Figma (não bate no rate limit). O embed vivo
// renderiza; as imagens do heatmap são buscadas depois, sob demanda.
export async function figmaLiveImportAction(
  studyId: string,
  fileKey: string,
  selected: ImportScreen[],
  entryNodeId?: string | null
): Promise<ImportResult> {
  try {
    if (!selected.length) return { ok: false, error: "Nenhuma tela selecionada." }
    const { study, userId } = await getOwnedEditableStudy(studyId)

    const screens = [...selected].sort((a, b) => Number(b.isStart) - Number(a.isStart))
    const startNodeId = (screens.find((s) => s.isStart) ?? screens[0])?.figmaId ?? null

    // exporta as tiras dos conteúdos roláveis (carrossel) → urls nas pieces
    await exportScrollStrips(studyId, await getDecryptedToken(userId), fileKey, screens)

    const proto =
      study.prototype ??
      (await prisma.prototype.create({
        data: { studyId: study.id, source: "figma", figmaFileKey: fileKey },
      }))
    await prisma.prototype.update({
      where: { id: proto.id },
      data: {
        source: "figma",
        figmaFileKey: fileKey,
        figmaStartNodeId: startNodeId,
        ...(entryNodeId !== undefined ? { figmaEntryNodeId: entryNodeId } : {}),
      },
    })

    const startOrder = study.prototype?.screens.length
      ? Math.max(...study.prototype.screens.map((s) => s.order)) + 1
      : 0

    for (let i = 0; i < screens.length; i++) {
      const s = screens[i]
      await prisma.screen.create({
        data: {
          prototypeId: proto.id,
          name: s.name,
          order: startOrder + i,
          imageUrl: "", // sem imagem no import leve; embed vivo não usa
          figmaNodeId: s.figmaId,
          width: s.width || 360,
          height: s.height || 800,
          scroll: s.scroll,
          scrollFrames: s.scrollFrames,
        },
      })
    }

    revalidatePath(`/studies/${studyId}`)
    return { ok: true, screens: screens.length, hotspots: 0 }
  } catch (e) {
    if (isNextControlFlow(e)) throw e
    return { ok: false, error: e instanceof Error ? e.message : "Falha na importação." }
  }
}

// Carrega as imagens das telas sob demanda (fundo do heatmap). O import ao vivo
// não baixa imagens; esta action busca só as que faltam (imageUrl vazio).
export async function loadFigmaImagesAction(
  studyId: string
): Promise<{ ok: true; loaded: number } | { ok: false; error: string }> {
  try {
    const userId = await requireUser()
    const study = await prisma.study.findUnique({
      where: { id: studyId, ownerId: userId },
      include: { prototype: true },
    })
    if (!study) return { ok: false, error: "Study não encontrado" }
    const proto = study.prototype
    if (!proto?.figmaFileKey) return { ok: false, error: "Estudo sem protótipo do Figma." }

    const screens = await prisma.screen.findMany({
      where: { prototypeId: proto.id, imageUrl: "", figmaNodeId: { not: null } },
      select: { id: true, figmaNodeId: true },
    })
    if (!screens.length) return { ok: true, loaded: 0 }

    const token = await getDecryptedToken(userId)
    const nodeIds = screens.map((s) => s.figmaNodeId as string)
    const urls = await figmaGetImages(token, proto.figmaFileKey, nodeIds, { scale: 2, format: "png" })

    let loaded = 0
    for (let i = 0; i < screens.length; i += 4) {
      const batch = screens.slice(i, i + 4)
      await Promise.all(
        batch.map(async (sc, j) => {
          const src = urls[sc.figmaNodeId as string]
          if (!src) return
          const publicUrl = await downloadAndUpload(studyId, src, i + j)
          await prisma.screen.update({ where: { id: sc.id }, data: { imageUrl: publicUrl } })
          loaded++
        })
      )
    }
    revalidatePath(`/studies/${studyId}/results`)
    return { ok: true, loaded }
  } catch (e) {
    if (isNextControlFlow(e)) throw e
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao carregar imagens." }
  }
}

// Atualizar protótipo (modo ao vivo): re-lê o plano do Figma a partir do mesmo
// nó de entrada e re-sincroniza o mapa de telas — ATUALIZA as existentes (por
// node-id: nome, tamanho, scroll) e ADICIONA as novas. Não deleta telas que
// sumiram do Figma (a FK de missão/objetivo é Cascade e apagaria missões).
// Também limpa as imagens do heatmap (storage + imageUrl="") para que os
// resultados baixem versões novas e reflitam mudanças visuais. Como o testador
// usa o embed VIVO, as mudanças de fluxo já aparecem lá automaticamente.
export async function figmaRefreshAction(
  studyId: string
): Promise<{ ok: true; updated: number; added: number } | { ok: false; error: string }> {
  try {
    const { study, userId } = await getOwnedEditableStudy(studyId)
    const proto = study.prototype
    if (!proto?.figmaFileKey) return { ok: false, error: "Estudo sem protótipo do Figma." }

    const token = await getDecryptedToken(userId)
    const entry = proto.figmaEntryNodeId ?? proto.figmaStartNodeId ?? null
    const fresh = await collectImportPlan(token, proto.figmaFileKey, entry)
    if (!fresh.length) {
      return { ok: false, error: "Nenhuma tela encontrada ao reler o protótipo." }
    }

    // exporta as tiras dos conteúdos roláveis (carrossel) → urls nas pieces
    await exportScrollStrips(studyId, token, proto.figmaFileKey, fresh)

    const existing = proto.screens
    const byNode = new Map(existing.filter((s) => s.figmaNodeId).map((s) => [s.figmaNodeId!, s]))

    let updated = 0
    let added = 0
    let nextOrder = existing.length ? Math.max(...existing.map((s) => s.order)) + 1 : 0

    for (const s of fresh) {
      const cur = byNode.get(s.figmaId)
      if (cur) {
        await prisma.screen.update({
          where: { id: cur.id },
          data: {
            name: s.name,
            width: s.width || 360,
            height: s.height || 800,
            scroll: s.scroll,
            scrollFrames: s.scrollFrames, // preenche a geometria dos frames roláveis
          },
        })
        updated++
      } else {
        await prisma.screen.create({
          data: {
            prototypeId: proto.id,
            name: s.name,
            order: nextOrder++,
            imageUrl: "",
            figmaNodeId: s.figmaId,
            width: s.width || 360,
            height: s.height || 800,
            scroll: s.scroll,
            scrollFrames: s.scrollFrames,
          },
        })
        added++
      }
    }

    // frame inicial pode ter mudado
    const startNodeId = (fresh.find((s) => s.isStart) ?? fresh[0])?.figmaId ?? proto.figmaStartNodeId
    await prisma.prototype.update({
      where: { id: proto.id },
      data: { figmaStartNodeId: startNodeId },
    })

    // limpa imagens antigas do heatmap → o auto-loader baixa versões novas
    await removeStorageByUrls(existing.map((s) => s.imageUrl))
    await prisma.screen.updateMany({ where: { prototypeId: proto.id }, data: { imageUrl: "" } })

    revalidatePath(`/studies/${studyId}`)
    revalidatePath(`/studies/${studyId}/results`)
    return { ok: true, updated, added }
  } catch (e) {
    if (isNextControlFlow(e)) throw e
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar o protótipo." }
  }
}

async function figmaImportImpl(
  studyId: string,
  fileKey: string,
  selected: ImportScreen[]
): Promise<{ screens: number; hotspots: number }> {
  const { study, userId } = await getOwnedEditableStudy(studyId)
  if (!selected.length) throw new Error("Nenhuma tela selecionada.")
  const token = await getDecryptedToken(userId)

  // ordena: tela inicial primeiro (se houver)
  const screens = [...selected].sort((a, b) => Number(b.isStart) - Number(a.isStart))

  // tiras dos conteúdos roláveis (carrossel) → urls nas pieces de scrollFrames
  await exportScrollStrips(studyId, token, fileKey, screens)

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
  // Frame inicial do protótipo (p/ o embed vivo): a tela marcada como início,
  // senão a primeira. Guardamos no formato do Figma ("0:19236").
  const startNodeId = (screens.find((s) => s.isStart) ?? screens[0])?.figmaId ?? null
  await prisma.prototype.update({
    where: { id: proto.id },
    data: { source: "figma", figmaFileKey: fileKey, figmaStartNodeId: startNodeId },
  })
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
        figmaNodeId: s.figmaId, // mapeia eventos do embed (presentedNodeId) → tela
        width: s.width || 360,
        height: s.height || 800,
        scroll: s.scroll,
        scrollFrames: s.scrollFrames,
      },
    })
    idMap[s.figmaId] = created.id
  }

  // 3b) peças de scroll: exporta cada pedaço do conteúdo rolável (container único
  //     ou cards soltos) em tamanho cheio e re-hospeda. Sem isso a região é
  //     detectada mas fica estática.
  const pieceIds = [
    ...new Set(
      screens.flatMap((s) =>
        s.regions.flatMap((r) => (r.pieces ?? []).map((p) => p.figmaId))
      )
    ),
  ]
  const pieceUrls: Record<string, string> = {}
  if (pieceIds.length) {
    const pieceExport = await figmaGetImages(token, fileKey, pieceIds, {
      scale: 2,
      format: "png",
    })
    for (let i = 0; i < pieceIds.length; i += 4) {
      const batch = pieceIds.slice(i, i + 4)
      await Promise.all(
        batch.map(async (id, j) => {
          const src = pieceExport[id]
          if (!src) return
          pieceUrls[id] = await downloadAndUpload(studyId, src, 10000 + i + j)
        })
      )
    }
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
      // fixed reaproveita a imagem da tela; scroll monta as peças exportadas.
      const pieces =
        r.kind === "scroll"
          ? (r.pieces ?? [])
              .map((p) => {
                const url = pieceUrls[p.figmaId]
                return url ? { url, ...p.box } : null
              })
              .filter((p): p is { url: string; x: number; y: number; w: number; h: number } => p != null)
          : []
      // união das peças (para o extensor de rolagem no runtime)
      const contentBox = pieces.length
        ? (() => {
            const x = Math.min(...pieces.map((p) => p.x))
            const y = Math.min(...pieces.map((p) => p.y))
            const w = Math.max(...pieces.map((p) => p.x + p.w)) - x
            const h = Math.max(...pieces.map((p) => p.y + p.h)) - y
            return { x, y, w, h }
          })()
        : null
      await prisma.scrollRegion.create({
        data: {
          screenId,
          kind: r.kind,
          coords: r.coords,
          axis: r.axis,
          imageUrl: null,
          ...(contentBox ? { contentBox } : {}),
          ...(pieces.length ? { pieces } : {}),
        },
      })
    }
  }

  revalidatePath(`/studies/${studyId}`)
  return { screens: screens.length, hotspots: hotspotCount }
}
