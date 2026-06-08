"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

interface HotspotInput {
  id?: string
  coords: { x: number; y: number; w: number; h: number }
  targetScreenId: string | null
  shape: "rect"
}

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

  // Replace all hotspots for this screen
  await prisma.hotspot.deleteMany({ where: { screenId } })

  await Promise.all(
    hotspots
      .filter((h) => h.targetScreenId && validScreenIds.has(h.targetScreenId))
      .map((h) =>
        prisma.hotspot.create({
          data: {
            screenId,
            shape: "rect",
            coords: h.coords,
            targetScreenId: h.targetScreenId!,
          },
        })
      )
  )

  revalidatePath(`/studies/${studyId}`)
  revalidatePath(`/studies/${studyId}/screens/${screenId}/hotspots`)
}
