"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function getStudyOrThrow(studyId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const study = await prisma.study.findUnique({
    where: { id: studyId, ownerId: session.user.id },
    include: { prototype: { include: { screens: { orderBy: { order: "asc" } } } } },
  })
  if (!study) throw new Error("Study não encontrado")
  return { study, userId: session.user.id }
}

// Bloqueia edições enquanto o estudo está "ao vivo" (preserva integridade do relatório).
function blockIfLive(study: { status: string }, studyId: string, tab?: string) {
  if (study.status === "live") {
    const msg = encodeURIComponent(
      "Encerre o estudo para editá-lo — alterar um teste ao vivo distorce os resultados."
    )
    redirect(`/studies/${studyId}?error=${msg}${tab ? `&tab=${tab}` : ""}`)
  }
}

export async function updateStudyTitleAction(studyId: string, formData: FormData) {
  const { study } = await getStudyOrThrow(studyId)
  const title = (formData.get("title") as string)?.trim()
  if (!title) return

  await prisma.study.update({ where: { id: study.id }, data: { title } })
  revalidatePath(`/studies/${studyId}`)
}

// Zera os dados coletados (sessões → eventos + resultados via cascade),
// mantendo protótipo/telas/missões. Útil para limpar testes internos antes
// de divulgar o link para os testadores reais.
export async function resetStudyDataAction(studyId: string) {
  const { study } = await getStudyOrThrow(studyId)
  await prisma.session.deleteMany({ where: { studyId: study.id } })
  revalidatePath(`/studies/${studyId}/results`)
  revalidatePath(`/studies/${studyId}`)
}

export async function updateWelcomeAction(
  studyId: string,
  input: { title: string; message: string }
) {
  const { study } = await getStudyOrThrow(studyId)
  await prisma.study.update({
    where: { id: study.id },
    data: {
      welcomeTitle: input.title.trim() || null,
      welcomeMessage: input.message.trim() || null,
    },
  })
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
  blockIfLive(study, studyId)

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
  blockIfLive(study, studyId)

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
  blockIfLive(study, studyId)

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
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId)
  const trimmed = name.trim()
  if (!trimmed) return
  await prisma.screen.update({ where: { id: screenId }, data: { name: trimmed } })
  revalidatePath(`/studies/${studyId}`)
}


interface MissionQuestionInput {
  type: "open" | "choice" | "rating" | "binary"
  title: string
  description?: string | null
  required: boolean
  options?: string[]
}

interface CreateMissionInput {
  task: string
  description?: string | null
  startScreenId: string
  successType: "screen" | "path"
  goalScreenId?: string | null
  paths?: string[][] // cada caminho: sequência de screenIds (start..final)
  questions?: MissionQuestionInput[] // perguntas de acompanhamento da missão
}

// Cria as perguntas de acompanhamento de uma missão (ordem = posição na lista).
async function createMissionQuestions(missionId: string, questions?: MissionQuestionInput[]) {
  if (!questions?.length) return
  const rows = questions
    .map((q, i) => {
      const title = q.title?.trim()
      if (!title) return null
      const isChoice = q.type === "choice"
      const options = isChoice
        ? (q.options ?? []).map((o) => o.trim()).filter(Boolean)
        : []
      if (isChoice && options.length < 2) return null
      return {
        missionId,
        order: i,
        type: q.type,
        title,
        description: q.description?.trim() || null,
        required: !!q.required,
        options,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  if (rows.length) await prisma.question.createMany({ data: rows })
}

export async function createMissionAction(
  studyId: string,
  input: CreateMissionInput
) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")

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

  const block = await prisma.block.create({
    data: { studyId: study.id, type: "mission", order: await nextBlockOrder(study.id) },
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

  await createMissionQuestions(mission.id, input.questions)

  redirect(`/studies/${studyId}?tab=missions`)
}

export async function updateMissionAction(
  studyId: string,
  missionId: string,
  input: CreateMissionInput
) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")

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

  // Substitui as perguntas de acompanhamento (remove as antigas, recria)
  await prisma.question.deleteMany({ where: { missionId } })
  await createMissionQuestions(missionId, input.questions)

  redirect(`/studies/${studyId}?tab=missions`)
}

export async function deleteMissionAction(studyId: string, missionId: string) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")

  const mission = await prisma.mission.findFirst({
    where: { id: missionId, block: { studyId: study.id } },
    select: { blockId: true },
  })
  if (!mission) return

  // Apaga o bloco → cascateia missão, goals, paths, steps, results e events
  await prisma.block.delete({ where: { id: mission.blockId } })
  revalidatePath(`/studies/${studyId}`)
}

// ─────────── Perguntas (blocos type=question) ───────────
type QType = "open" | "choice" | "rating" | "binary"
interface QuestionInput {
  type: QType
  title: string
  description?: string | null
  required: boolean
  options?: string[]
}

// Próxima ordem de bloco = (maior ordem atual) + 1 — evita colisões após deleções.
async function nextBlockOrder(studyId: string) {
  const last = await prisma.block.findFirst({
    where: { studyId },
    orderBy: { order: "desc" },
    select: { order: true },
  })
  return (last?.order ?? -1) + 1
}

function cleanQuestionInput(input: QuestionInput) {
  const title = input.title?.trim()
  if (!title) return null
  const isChoice = input.type === "choice"
  const options = isChoice
    ? (input.options ?? []).map((o) => o.trim()).filter(Boolean)
    : []
  if (isChoice && options.length < 2) return null // múltipla escolha precisa de ≥2 opções
  return {
    type: input.type,
    title,
    description: input.description?.trim() || null,
    required: !!input.required,
    options,
  }
}

export async function createQuestionAction(studyId: string, input: QuestionInput) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")
  const clean = cleanQuestionInput(input)
  if (!clean) return

  const block = await prisma.block.create({
    data: { studyId: study.id, type: "question", order: await nextBlockOrder(study.id) },
  })
  await prisma.question.create({
    data: {
      blockId: block.id,
      type: clean.type,
      title: clean.title,
      description: clean.description,
      required: clean.required,
      options: clean.options,
    },
  })
  revalidatePath(`/studies/${studyId}`)
}

export async function updateQuestionAction(
  studyId: string,
  questionId: string,
  input: QuestionInput
) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")
  const existing = await prisma.question.findFirst({
    where: { id: questionId, block: { studyId: study.id } },
    select: { id: true },
  })
  if (!existing) return
  const clean = cleanQuestionInput(input)
  if (!clean) return

  await prisma.question.update({
    where: { id: questionId },
    data: {
      type: clean.type,
      title: clean.title,
      description: clean.description,
      required: clean.required,
      options: clean.options,
    },
  })
  revalidatePath(`/studies/${studyId}`)
}

export async function deleteQuestionAction(studyId: string, questionId: string) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")
  const q = await prisma.question.findFirst({
    where: { id: questionId, block: { studyId: study.id } },
    select: { blockId: true },
  })
  if (!q?.blockId) return
  await prisma.block.delete({ where: { id: q.blockId } }) // cascateia Question + Answers
  revalidatePath(`/studies/${studyId}`)
}

// Reordena a SEQUÊNCIA (missões + perguntas): troca de posição e reindexa 0..n-1.
export async function moveBlockAction(
  studyId: string,
  blockId: string,
  direction: "up" | "down"
) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")

  const blocks = await prisma.block.findMany({
    where: { studyId: study.id },
    orderBy: { order: "asc" },
    select: { id: true },
  })
  const idx = blocks.findIndex((b) => b.id === blockId)
  if (idx === -1) return
  const swapIdx = direction === "up" ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= blocks.length) return

  const reordered = [...blocks]
  ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

  await Promise.all(
    reordered.map((b, i) => prisma.block.update({ where: { id: b.id }, data: { order: i } }))
  )
  revalidatePath(`/studies/${studyId}`)
}

// Persiste a ordem completa da sequência (usado pelo drag-and-drop).
export async function reorderBlocksAction(studyId: string, orderedIds: string[]) {
  const { study } = await getStudyOrThrow(studyId)
  blockIfLive(study, studyId, "missions")

  const blocks = await prisma.block.findMany({
    where: { studyId: study.id },
    select: { id: true },
  })
  const validIds = new Set(blocks.map((b) => b.id))
  const ids = orderedIds.filter((id) => validIds.has(id))
  // Precisa conter exatamente todos os blocos do estudo (nada a mais/menos).
  if (ids.length !== blocks.length) return

  await Promise.all(
    ids.map((id, i) => prisma.block.update({ where: { id }, data: { order: i } }))
  )
  revalidatePath(`/studies/${studyId}`)
}
