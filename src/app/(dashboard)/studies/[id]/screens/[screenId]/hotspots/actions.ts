"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type HotspotActionType = "navigate" | "open_overlay" | "close_overlay" | "back"

interface HotspotInput {
  id?: string
  coords: { x: number; y: number; w: number; h: number }
  action: HotspotActionType
  overlayPosition?: "bottom" | "center" | null
  targetScreenId: string | null
  shape: "rect"
}

const NEEDS_TARGET = new Set<HotspotActionType>(["navigate", "open_overlay"])

export async function saveHotspotsAction(
  studyId: string,
  screenId: string,
  hotspots: HotspotInput[]
) {
  const session = await auth()
  if (!session) redirect("/login")

  // Verifica que a tela pertence a um study DO USUÁRIO LOGADO
  const screen = await prisma.screen.findFirst({
    where: {
      id: screenId,
      prototype: { study: { id: studyId, ownerId: session.user.id } },
    },
    include: {
      prototype: {
        include: { study: { select: { status: true } }, screens: { select: { id: true } } },
      },
    },
  })
  if (!screen) throw new Error("Tela não encontrada")

  // Não permite editar hotspots de um estudo ao vivo (preserva o relatório)
  if (screen.prototype.study.status === "live") {
    redirect(`/studies/${studyId}?error=${encodeURIComponent("Encerre o estudo para editar os hotspots.")}`)
  }

  // Só aceita destinos que pertencem ao mesmo protótipo
  const validScreenIds = new Set(screen.prototype.screens.map((s) => s.id))

  // Mantém só hotspots válidos: ações que navegam precisam de destino no protótipo;
  // close_overlay/back não usam destino.
  const valid = hotspots.filter((h) => {
    if (NEEDS_TARGET.has(h.action)) {
      return !!h.targetScreenId && validScreenIds.has(h.targetScreenId)
    }
    return true
  })

  // Replace all hotspots for this screen
  await prisma.hotspot.deleteMany({ where: { screenId } })

  await Promise.all(
    valid.map((h) =>
      prisma.hotspot.create({
        data: {
          screenId,
          shape: "rect",
          coords: h.coords,
          action: h.action,
          overlayPosition: h.action === "open_overlay" ? (h.overlayPosition ?? "bottom") : null,
          targetScreenId: NEEDS_TARGET.has(h.action) ? h.targetScreenId : null,
        },
      })
    )
  )

  revalidatePath(`/studies/${studyId}`)
  revalidatePath(`/studies/${studyId}/screens/${screenId}/hotspots`)
}

async function assertOwnerEditable(studyId: string, screenId: string) {
  const session = await auth()
  if (!session) redirect("/login")
  const screen = await prisma.screen.findFirst({
    where: { id: screenId, prototype: { study: { id: studyId, ownerId: session.user.id } } },
    include: { prototype: { include: { study: { select: { status: true } } } } },
  })
  if (!screen) throw new Error("Tela não encontrada")
  if (screen.prototype.study.status === "live") {
    redirect(`/studies/${studyId}?error=${encodeURIComponent("Encerre o estudo para editar.")}`)
  }
  return screen
}

/** Faz upload da tira (conteúdo completo) de uma região de scroll. Retorna a URL pública. */
export async function uploadScrollStripAction(
  studyId: string,
  screenId: string,
  formData: FormData
): Promise<string> {
  await assertOwnerEditable(studyId, screenId)
  const file = formData.get("file") as File
  if (!file) throw new Error("Arquivo ausente")

  const ext = file.name.split(".").pop() ?? "png"
  const storagePath = `${studyId}/strips/${screenId}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from("screens")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data } = supabase.storage.from("screens").getPublicUrl(storagePath)
  return data.publicUrl
}

interface ScrollRegionInput {
  coords: { x: number; y: number; w: number; h: number }
  axis: "horizontal" | "vertical" | "both"
  imageUrl: string
}

export async function saveScrollRegionsAction(
  studyId: string,
  screenId: string,
  regions: ScrollRegionInput[]
) {
  await assertOwnerEditable(studyId, screenId)

  await prisma.scrollRegion.deleteMany({ where: { screenId } })
  await Promise.all(
    regions
      .filter((r) => r.imageUrl)
      .map((r) =>
        prisma.scrollRegion.create({
          data: { screenId, coords: r.coords, axis: r.axis, imageUrl: r.imageUrl },
        })
      )
  )

  revalidatePath(`/studies/${studyId}/screens/${screenId}/hotspots`)
  revalidatePath(`/studies/${studyId}`)
}

export async function updateScreenScrollAction(
  studyId: string,
  screenId: string,
  scroll: "none" | "vertical" | "horizontal" | "both"
) {
  const session = await auth()
  if (!session) redirect("/login")

  const screen = await prisma.screen.findFirst({
    where: { id: screenId, prototype: { study: { id: studyId, ownerId: session.user.id } } },
    include: { prototype: { include: { study: { select: { status: true } } } } },
  })
  if (!screen) throw new Error("Tela não encontrada")
  if (screen.prototype.study.status === "live") {
    redirect(`/studies/${studyId}?error=${encodeURIComponent("Encerre o estudo para editar.")}`)
  }

  await prisma.screen.update({ where: { id: screenId }, data: { scroll } })
  revalidatePath(`/studies/${studyId}/screens/${screenId}/hotspots`)
}
