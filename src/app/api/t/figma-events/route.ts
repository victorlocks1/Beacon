import { prisma } from "@/lib/db"
import { FIGMA_EVENT_TYPES } from "@/lib/figma-embed"

const VALID = new Set<string>(FIGMA_EVENT_TYPES)

interface IncomingEvent {
  type: string
  data: unknown
  clientTsMs: number
}

// Recebe os eventos crus da Embed API do Figma (protótipo vivo) e os grava.
// As métricas são derivadas depois (fases 2/3) a partir desse log.
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
    .filter((e) => VALID.has(e.type))
    .slice(0, 2000)
    .map((e) => ({
      sessionId: session.id,
      type: e.type,
      data: (e.data ?? {}) as object,
      clientTsMs: BigInt(Math.round(Number(e.clientTsMs) || 0)),
    }))

  if (rows.length > 0) {
    await prisma.figmaEventLog.createMany({ data: rows })
  }

  return Response.json({ ok: true, inserted: rows.length })
}
