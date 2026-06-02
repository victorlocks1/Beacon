"use server"
import { prisma } from "@/lib/db"
import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
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

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (exists) redirect("/register?error=taken")

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    },
  })

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/studies",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login")
    }
    throw error
  }
}
