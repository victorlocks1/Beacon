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

export async function publishStudyAction(studyId: string) {
  const { study } = await getStudyOrThrow(studyId)

  const screenCount = study.prototype?.screens.length ?? 0
  const missionCount = await prisma.block.count({
    where: { studyId: study.id, type: "mission" },
  })

  if (screenCount === 0 || missionCount === 0) {
    redirect(
      `/studies/${studyId}?error=${encodeURIComponent("Adicione ao menos uma tela e uma missão antes de publicar.")}`
    )
  }

  await prisma.study.update({ where: { id: study.id }, data: { status: "live" } })
  revalidatePath(`/studies/${studyId}`)
}

export async function closeStudyAction(studyId: string) {
  const { study } = await getStudyOrThrow(studyId)
  await prisma.study.update({ where: { id: study.id }, data: { status: "closed" } })
  revalidatePath(`/studies/${studyId}`)
}

export async function reopenStudyAction(studyId: string) {
  const { study } = await getStudyOrThrow(studyId)
  await prisma.study.update({ where: { id: study.id }, data: { status: "live" } })
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
    include: {
      missionStarts: { select: { id: true } },
      missionGoals: { select: { id: true } },
      pathSteps: { select: { id: true } },
    },
  })
  if (!screen) return

  if (
    screen.missionStarts.length > 0 ||
    screen.missionGoals.length > 0 ||
    screen.pathSteps.length > 0
  ) {
    redirect(
      `/studies/${studyId}?error=${encodeURIComponent("Esta tela está sendo usada em uma missão. Remova a missão antes de excluir.")}`
    )
  }

  // Remove hotspots that apontam PARA esta tela antes de deletar
  await prisma.hotspot.deleteMany({ where: { targetScreenId: screenId } })

  const url = new URL(screen.imageUrl)
  const storagePath = url.pathname.split("/object/public/screens/")[1]
  if (storagePath) {
    await supabase.storage.from("screens").remove([storagePath])
  }

  await prisma.screen.delete({ where: { id: screenId } })
  revalidatePath(`/studies/${studyId}`)
}

export async function moveScreenAction(
  studyId: string,
  screenId: string,
  direction: "up" | "down"
) {
  const { study } = await getStudyOrThrow(studyId)

  const screens = await prisma.screen.findMany({
    where: { prototype: { studyId: study.id } },
    orderBy: { order: "asc" },
  })

  const idx = screens.findIndex((s) => s.id === screenId)
  if (idx === -1) return

  const swapIdx = direction === "up" ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= screens.length) return

  const a = screens[idx]
  const b = screens[swapIdx]

  await Promise.all([
    prisma.screen.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.screen.update({ where: { id: b.id }, data: { order: a.order } }),
  ])

  revalidatePath(`/studies/${studyId}`)
}

export async function updateScreenNameAction(
  studyId: string,
  screenId: string,
  name: string
) {
  await getStudyOrThrow(studyId)
  const trimmed = name.trim()
  if (!trimmed) return
  await prisma.screen.update({ where: { id: screenId }, data: { name: trimmed } })
  revalidatePath(`/studies/${studyId}`)
}


interface CreateMissionInput {
  task: string
  description?: string | null
  startScreenId: string
  successType: "screen" | "path"
  goalScreenId?: string | null
  paths?: string[][] // cada caminho: sequência de screenIds (start..final)
}

export async function createMissionAction(
  studyId: string,
  input: CreateMissionInput
) {
  const { study } = await getStudyOrThrow(studyId)

  const task = input.task?.trim()
  const description = input.description?.trim() || null
  const startScreenId = input.startScreenId

  if (!task || !startScreenId) return

  // Todas as telas referenciadas devem pertencer ao protótipo deste study
  const ownScreenIds = new Set((study.prototype?.screens ?? []).map((s) => s.id))
  if (!ownScreenIds.has(startScreenId)) return

  // Validação por tipo de sucesso
  if (input.successType === "screen") {
    if (!input.goalScreenId || !ownScreenIds.has(input.goalScreenId)) return
  } else {
    const validPaths = (input.paths ?? []).filter(
      (p) => p.length >= 2 && p.every((sid) => ownScreenIds.has(sid))
    )
    if (validPaths.length === 0) return
  }

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
      successType: input.successType,
    },
  })

  if (input.successType === "screen") {
    await prisma.missionGoal.create({
      data: { missionId: mission.id, goalScreenId: input.goalScreenId! },
    })
  } else {
    const validPaths = (input.paths ?? []).filter(
      (p) => p.length >= 2 && p.every((sid) => ownScreenIds.has(sid))
    )
    for (let i = 0; i < validPaths.length; i++) {
      const path = validPaths[i]
      const missionPath = await prisma.missionPath.create({
        data: { missionId: mission.id, label: `Caminho ${i + 1}` },
      })
      await prisma.pathStep.createMany({
        data: path.map((screenId, order) => ({
          missionPathId: missionPath.id,
          screenId,
          order,
        })),
      })
    }
  }

  redirect(`/studies/${studyId}`)
}

export async function updateMissionAction(
  studyId: string,
  missionId: string,
  input: CreateMissionInput
) {
  const { study } = await getStudyOrThrow(studyId)

  // A missão precisa pertencer a este study
  const existing = await prisma.mission.findFirst({
    where: { id: missionId, block: { studyId: study.id } },
  })
  if (!existing) return

  const task = input.task?.trim()
  const description = input.description?.trim() || null
  const startScreenId = input.startScreenId
  if (!task || !startScreenId) return

  const ownScreenIds = new Set((study.prototype?.screens ?? []).map((s) => s.id))
  if (!ownScreenIds.has(startScreenId)) return

  if (input.successType === "screen") {
    if (!input.goalScreenId || !ownScreenIds.has(input.goalScreenId)) return
  } else {
    const validPaths = (input.paths ?? []).filter(
      (p) => p.length >= 2 && p.every((sid) => ownScreenIds.has(sid))
    )
    if (validPaths.length === 0) return
  }

  await prisma.mission.update({
    where: { id: missionId },
    data: { task, description, startScreenId, successType: input.successType },
  })

  // Substitui critério de sucesso (remove o antigo, recria o novo)
  await prisma.missionGoal.deleteMany({ where: { missionId } })
  await prisma.missionPath.deleteMany({ where: { missionId } }) // cascateia PathSteps

  if (input.successType === "screen") {
    await prisma.missionGoal.create({
      data: { missionId, goalScreenId: input.goalScreenId! },
    })
  } else {
    const validPaths = (input.paths ?? []).filter(
      (p) => p.length >= 2 && p.every((sid) => ownScreenIds.has(sid))
    )
    for (let i = 0; i < validPaths.length; i++) {
      const path = validPaths[i]
      const missionPath = await prisma.missionPath.create({
        data: { missionId, label: `Caminho ${i + 1}` },
      })
      await prisma.pathStep.createMany({
        data: path.map((screenId, order) => ({
          missionPathId: missionPath.id,
          screenId,
          order,
        })),
      })
    }
  }

  redirect(`/studies/${studyId}`)
}

export async function deleteMissionAction(studyId: string, missionId: string) {
  const { study } = await getStudyOrThrow(studyId)

  const mission = await prisma.mission.findFirst({
    where: { id: missionId, block: { studyId: study.id } },
    select: { blockId: true },
  })
  if (!mission) return

  // Apaga o bloco → cascateia missão, goals, paths, steps, results e events
  await prisma.block.delete({ where: { id: mission.blockId } })
  revalidatePath(`/studies/${studyId}`)
}
