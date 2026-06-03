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

  // Verify ownership
  const screen = await prisma.screen.findFirst({
    where: { id: screenId, prototype: { studyId } },
  })
  if (!screen) throw new Error("Tela não encontrada")

  // Replace all hotspots for this screen
  await prisma.hotspot.deleteMany({ where: { screenId } })

  await Promise.all(
    hotspots
      .filter((h) => h.targetScreenId)
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
