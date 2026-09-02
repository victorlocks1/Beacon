"use server"
import { prisma } from "@/lib/db"
import { supabase as supabaseAdmin } from "@/lib/supabase"
import { supabaseServer } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { z } from "zod"

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
})

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    const msg = encodeURIComponent(parsed.error.issues[0].message)
    redirect(`/register?error=${msg}`)
  }

  const email = parsed.data.email.toLowerCase()
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) redirect("/register?error=taken")

  // Cria o usuário no Supabase Auth já CONFIRMADO (login imediato, sem depender
  // de confirmação de e-mail). Usa a service role (admin).
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (error || !data.user) redirect("/register?error=taken")

  // Cria o registro `User` do Beacon (mapeado por e-mail). O passwordHash legado
  // não é mais usado (a senha vive no Supabase Auth).
  await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash: "supabase-auth" },
  })

  // Autentica (seta o cookie de sessão) e segue.
  const supabase = await supabaseServer()
  await supabase.auth.signInWithPassword({ email, password: parsed.data.password })
  redirect("/projects")
}
