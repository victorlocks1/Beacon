import { prisma } from "@/lib/db"

type Outcome = "direct" | "indirect" | "unfinished" | "given_up"

function reconstructPath(
  navEvents: { targetScreenId: string | null }[]
): string[] {
  const ids: string[] = []
  for (const e of navEvents) {
    if (!e.targetScreenId) continue
    if (ids[ids.length - 1] !== e.targetScreenId) ids.push(e.targetScreenId)
  }
  return ids
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export async function POST(request: Request) {
  let body: {
    token?: string
    missionId?: string
    signal?: "reached" | "gave_up"
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

  const { token, missionId, signal, durationMs, misclickCount, clickCount, isLast } = body

  if (!token || !missionId || (signal !== "reached" && signal !== "gave_up")) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const session = await prisma.session.findUnique({ where: { token } })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: { paths: { include: { steps: { orderBy: { order: "asc" } } } } },
  })
  if (!mission) {
    return Response.json({ ok: false, error: "mission_not_found" }, { status: 404 })
  }

  // ── Classificação do desfecho ──
  let outcome: Outcome
  if (signal === "gave_up") {
    outcome = "given_up"
  } else if (mission.successType === "screen") {
    outcome = "direct"
  } else {
    // path: compara caminho real com os esperados
    const navEvents = await prisma.event.findMany({
      where: { sessionId: session.id, missionId, type: "navigate" },
      orderBy: { timestampMs: "asc" },
      select: { targetScreenId: true },
    })
    const actual = reconstructPath(navEvents)
    const expectedPaths = mission.paths.map((p) => p.steps.map((s) => s.screenId))
    const matches = expectedPaths.some((exp) => arraysEqual(exp, actual))
    outcome = matches ? "direct" : "indirect"
  }

  // Evita duplicar resultado
  const existing = await prisma.missionResult.findFirst({
    where: { sessionId: session.id, missionId },
  })

  if (!existing) {
    await prisma.missionResult.create({
      data: {
        sessionId: session.id,
        missionId,
        outcome,
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

  return Response.json({ ok: true, outcome })
}
