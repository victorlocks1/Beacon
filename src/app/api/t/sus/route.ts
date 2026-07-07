import { prisma } from "@/lib/db"
import { susScore, SUS_ITEM_COUNT } from "@/lib/sus"

// Grava as 10 respostas do SUS de uma sessão e o score calculado (0..100).
export async function POST(request: Request) {
  let body: { token?: string; values?: number[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const { token, values } = body
  if (
    !token ||
    !Array.isArray(values) ||
    values.length !== SUS_ITEM_COUNT ||
    values.some((v) => !Number.isInteger(v) || v < 1 || v > 5)
  ) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const session = await prisma.session.findUnique({ where: { token }, select: { id: true } })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }

  const score = susScore(values)
  await prisma.susResponse.upsert({
    where: { sessionId: session.id },
    create: { sessionId: session.id, values, score },
    update: { values, score },
  })

  return Response.json({ ok: true, score })
}
