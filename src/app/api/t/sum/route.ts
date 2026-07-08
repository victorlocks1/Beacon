import { prisma } from "@/lib/db"

// Grava a resposta SEQ (facilidade, 1..7) de UMA tarefa da sessão (SUM).
export async function POST(request: Request) {
  let body: { token?: string; missionId?: string; ease?: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const { token, missionId, ease } = body
  if (
    !token ||
    !missionId ||
    !Number.isInteger(ease) ||
    (ease as number) < 1 ||
    (ease as number) > 7
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
    create: { sessionId: session.id, missionId, ease: ease as number },
    update: { ease: ease as number },
  })

  return Response.json({ ok: true })
}
