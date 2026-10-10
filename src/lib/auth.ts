import { supabaseServer } from "@/lib/supabase-server"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { cache } from "react"

// Sessão no MESMO formato do NextAuth anterior: session.user.id = User.id do
// Beacon. Assim todos os pontos que já usavam `auth()` continuam funcionando sem
// alteração. A autenticação passou a ser do Supabase Auth; aqui mapeamos o
// usuário autenticado (por e-mail) para o registro `User` do Beacon.
export type Session = {
  user: { id: string; email: string; name: string | null }
} | null

// `cache` do React: dentro de UMA mesma requisição, layout, página e actions
// compartilham o resultado — antes cada um refazia a ida ao Supabase Auth e a
// consulta do usuário (2–3 vezes por clique).
export const auth = cache(async function auth(): Promise<Session> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase()
  if (!email) return null

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  })
  if (!dbUser) return null
  return { user: { id: dbUser.id, email: dbUser.email, name: dbUser.name } }
})

export async function signOut(opts?: { redirectTo?: string }) {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect(opts?.redirectTo ?? "/login")
}
