import { prisma } from "@/lib/db"

const VALID_OUTCOMES = new Set([
  "direct",
  "indirect",
  "unfinished",
  "given_up",
])

export async function POST(request: Request) {
  let body: {
    token?: string
    missionId?: string
    outcome?: string
    durationMs?: number
    misclickCount?: number
    clickCount?: number
    isLast?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const { token, missionId, outcome, durationMs, misclickCount, clickCount, isLast } = body

  if (!token || !missionId || !outcome || !VALID_OUTCOMES.has(outcome)) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const session = await prisma.session.findUnique({ where: { token } })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }

  // Evita duplicar resultado se o complete for chamado mais de uma vez
  const existing = await prisma.missionResult.findFirst({
    where: { sessionId: session.id, missionId },
  })

  if (!existing) {
    await prisma.missionResult.create({
      data: {
        sessionId: session.id,
        missionId,
        outcome: outcome as "direct" | "indirect" | "unfinished" | "given_up",
        durationMs: Math.round(durationMs ?? 0),
        misclickCount: Math.round(misclickCount ?? 0),
        clickCount: Math.round(clickCount ?? 0),
      },
    })
  }

  if (isLast && !session.finishedAt) {
    await prisma.session.update({
      where: { id: session.id },
      data: { finishedAt: new Date() },
    })
  }

  return Response.json({ ok: true })
}
