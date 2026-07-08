import { prisma } from "@/lib/db"
import { reconstructPath, arraysEqual, dedupeConsecutive } from "@/lib/path"

type Outcome = "direct" | "indirect" | "unfinished" | "given_up"

export async function POST(request: Request) {
  let body: {
    token?: string
    missionId?: string
    signal?: "reached" | "gave_up"
    outcome?: "direct" | "indirect" // classificação do cliente (caminho exato)
    path?: string[]
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

  const { token, missionId, signal, outcome: clientOutcome, path, durationMs, misclickCount, clickCount, isLast } = body

  if (!token || !missionId || (signal !== "reached" && signal !== "gave_up")) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const session = await prisma.session.findUnique({ where: { token } })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: {
      block: { select: { studyId: true } },
      paths: { include: { steps: { orderBy: { order: "asc" } } } },
    },
  })
  // A missão precisa pertencer ao MESMO study da sessão
  if (!mission || mission.block.studyId !== session.studyId) {
    return Response.json({ ok: false, error: "mission_not_found" }, { status: 404 })
  }

  // ── Classificação do desfecho ──
  let outcome: Outcome
  if (signal === "gave_up") {
    outcome = "given_up"
  } else if (mission.successType === "screen") {
    outcome = "direct"
  } else if (clientOutcome === "direct" || clientOutcome === "indirect") {
    // CAMINHO EXATO: o cliente (rastreador do caminho) enxerga toda a navegação
    // e só sinaliza "reached" quando o caminho exato foi percorrido; a distinção
    // direto/indireto vem dele (fonte da verdade da navegação).
    outcome = clientOutcome
  } else {
    // Fallback (cliente antigo/sem outcome): reconstrói pelos eventos/caminho.
    let actual: string[]
    if (Array.isArray(path) && path.length > 0) {
      actual = dedupeConsecutive(path)
    } else {
      const navEvents = await prisma.event.findMany({
        where: { sessionId: session.id, missionId, type: "navigate" },
        orderBy: { timestampMs: "asc" },
        select: { targetScreenId: true },
      })
      actual = reconstructPath(navEvents)
    }
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

  // A sessão só é finalizada no fim da sequência inteira (via /api/t/finish),
  // pois pode haver perguntas depois da última missão.
  void isLast

  return Response.json({ ok: true, outcome })
}
