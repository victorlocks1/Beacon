"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function getStudyOrThrow(studyId: string) {
  const session = await auth()
  if (!session) redirect("/login")

  const study = await prisma.study.findUnique({
    where: { id: studyId, ownerId: session.user.id },
    include: { prototype: { include: { screens: { orderBy: { order: "asc" } } } } },
  })
  if (!study) throw new Error("Study não encontrado")
  return { study, userId: session.user.id }
}

export async function updateStudyTitleAction(studyId: string, formData: FormData) {
  const { study } = await getStudyOrThrow(studyId)
  const title = (formData.get("title") as string)?.trim()
  if (!title) return

  await prisma.study.update({ where: { id: study.id }, data: { title } })
  revalidatePath(`/studies/${studyId}`)
}

export async function uploadScreensAction(studyId: string, formData: FormData) {
  const { study } = await getStudyOrThrow(studyId)

  type PrototypeWithScreens = NonNullable<typeof study.prototype> & {
    screens: NonNullable<typeof study.prototype>["screens"]
  }

  let proto: PrototypeWithScreens
  if (!study.prototype) {
    const created = await prisma.prototype.create({
      data: { studyId: study.id, source: "image" },
      include: { screens: true },
    })
    proto = created
  } else {
    proto = study.prototype
  }

  const currentMaxOrder =
    proto.screens.length > 0
      ? Math.max(...proto.screens.map((s) => s.order))
      : -1

  const files = formData.getAll("files") as File[]
  const widths = formData.getAll("widths") as string[]
  const heights = formData.getAll("heights") as string[]
  const names = formData.getAll("names") as string[]

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split(".").pop() ?? "png"
    const storagePath = `${studyId}/${Date.now()}-${i}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await supabase.storage
      .from("screens")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (error) throw new Error(`Upload falhou: ${error.message}`)

    const { data: urlData } = supabase.storage
      .from("screens")
      .getPublicUrl(storagePath)

    await prisma.screen.create({
      data: {
        prototypeId: proto.id,
        name: (names[i] as string) || file.name.replace(/\.[^/.]+$/, ""),
        order: currentMaxOrder + i + 1,
        imageUrl: urlData.publicUrl,
        width: parseInt((widths[i] as string) ?? "1920") || 1920,
        height: parseInt((heights[i] as string) ?? "1080") || 1080,
      },
    })
  }

  revalidatePath(`/studies/${studyId}`)
}

export async function deleteScreenAction(studyId: string, screenId: string) {
  const { study } = await getStudyOrThrow(studyId)

  const screen = await prisma.screen.findUnique({
    where: { id: screenId, prototype: { studyId: study.id } },
  })
  if (!screen) return

  // Extract storage path from public URL
  const url = new URL(screen.imageUrl)
  const storagePath = url.pathname.split("/object/public/screens/")[1]
  if (storagePath) {
    await supabase.storage.from("screens").remove([storagePath])
  }

  await prisma.screen.delete({ where: { id: screenId } })
  revalidatePath(`/studies/${studyId}`)
}

export async function reorderScreensAction(
  studyId: string,
  orderedIds: string[]
) {
  await getStudyOrThrow(studyId)

  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.screen.update({ where: { id }, data: { order: index } })
    )
  )
  revalidatePath(`/studies/${studyId}`)
}

export async function createMissionAction(studyId: string, formData: FormData) {
  const { study } = await getStudyOrThrow(studyId)

  const task = (formData.get("task") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null
  const startScreenId = formData.get("startScreenId") as string
  const goalScreenId = formData.get("goalScreenId") as string

  if (!task || !startScreenId || !goalScreenId) return

  const maxOrder = await prisma.block.count({ where: { studyId: study.id } })

  const block = await prisma.block.create({
    data: { studyId: study.id, type: "mission", order: maxOrder },
  })

  const mission = await prisma.mission.create({
    data: {
      blockId: block.id,
      task,
      description,
      startScreenId,
      successType: "screen",
    },
  })

  await prisma.missionGoal.create({
    data: { missionId: mission.id, goalScreenId },
  })

  redirect(`/studies/${studyId}`)
}
