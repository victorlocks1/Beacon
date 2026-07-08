import { prisma } from "@/lib/db"
import { SUM_QUESTION_COUNT } from "@/lib/sum"

// Grava as 3 respostas do ASQ (1..7) de UMA tarefa da sessão (SUM).
export async function POST(request: Request) {
  let body: { token?: string; missionId?: string; values?: number[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const { token, missionId, values } = body
  if (
    !token ||
    !missionId ||
    !Array.isArray(values) ||
    values.length !== SUM_QUESTION_COUNT ||
    values.some((v) => !Number.isInteger(v) || v < 1 || v > 7)
  ) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  // valida token → sessão e que a missão pertence ao estudo da sessão
  const session = await prisma.session.findUnique({
    where: { token },
    select: { id: true, studyId: true },
  })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }
  const mission = await prisma.mission.findFirst({
    where: { id: missionId, block: { studyId: session.studyId } },
    select: { id: true },
  })
  if (!mission) {
    return Response.json({ ok: false, error: "mission_not_found" }, { status: 404 })
  }

  await prisma.sumResponse.upsert({
    where: { sessionId_missionId: { sessionId: session.id, missionId } },
    create: { sessionId: session.id, missionId, values },
    update: { values },
  })

  return Response.json({ ok: true })
}
