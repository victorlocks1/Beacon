import { prisma } from "@/lib/db"

const VALID_TYPES = new Set(["click", "navigate", "misclick", "give_up", "end"])

interface IncomingEvent {
  missionId: string
  screenId: string
  type: string
  xNorm: number
  yNorm: number
  hotspotId?: string | null
  targetScreenId?: string | null
  timestampMs: number
}

export async function POST(request: Request) {
  let body: { token?: string; events?: IncomingEvent[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const { token, events } = body
  if (!token || !Array.isArray(events) || events.length === 0) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const session = await prisma.session.findUnique({ where: { token } })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }

  const rows = events
    .filter((e) => VALID_TYPES.has(e.type) && e.missionId && e.screenId)
    .map((e) => ({
      sessionId: session.id,
      missionId: e.missionId,
      screenId: e.screenId,
      type: e.type as "click" | "navigate" | "misclick" | "give_up" | "end",
      xNorm: Number(e.xNorm) || 0,
      yNorm: Number(e.yNorm) || 0,
      hotspotId: e.hotspotId ?? null,
      targetScreenId: e.targetScreenId ?? null,
      timestampMs: BigInt(Math.round(e.timestampMs ?? 0)),
    }))

  if (rows.length > 0) {
    await prisma.event.createMany({ data: rows })
  }

  return Response.json({ ok: true, inserted: rows.length })
}
