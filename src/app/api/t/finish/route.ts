import { prisma } from "@/lib/db"

// Marca a sessão como finalizada ao fim da sequência inteira (missões + perguntas).
export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const { token } = body
  if (!token) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const session = await prisma.session.findUnique({
    where: { token },
    select: { id: true, finishedAt: true },
  })
  if (!session) {
    return Response.json({ ok: false, error: "session_not_found" }, { status: 404 })
  }

  if (!session.finishedAt) {
    await prisma.session.update({
      where: { id: session.id },
      data: { finishedAt: new Date() },
    })
  }

  return Response.json({ ok: true })
}
