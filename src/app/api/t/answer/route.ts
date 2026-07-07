import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  let body: {
    token?: string
    questionId?: string
    text?: string | null
    choice?: string | null
    rating?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const { token, questionId, text, choice, rating } = body
  if (!token || !questionId) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const session = await prisma.session.findUnique({
    where: { token },
    select: { id: true, studyId: true },
  })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }

  // A pergunta precisa pertencer ao MESMO study da sessão
  // A pergunta precisa pertencer ao MESMO study — seja geral (block) OU de
  // acompanhamento de missão (mission.block). Antes só aceitava block → as
  // perguntas de missão eram rejeitadas e a resposta não salvava.
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      OR: [
        { block: { studyId: session.studyId } },
        { mission: { block: { studyId: session.studyId } } },
      ],
    },
    select: { id: true },
  })
  if (!question) {
    return Response.json({ ok: false, error: "question_not_found" }, { status: 404 })
  }

  const data = {
    text: typeof text === "string" && text.length ? text : null,
    choice: typeof choice === "string" && choice.length ? choice : null,
    rating: typeof rating === "number" ? Math.round(rating) : null,
  }

  await prisma.answer.upsert({
    where: { sessionId_questionId: { sessionId: session.id, questionId } },
    create: { sessionId: session.id, questionId, ...data },
    update: data,
  })

  return Response.json({ ok: true })
}
