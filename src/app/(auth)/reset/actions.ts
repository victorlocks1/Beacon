"use server"
import { supabaseServer } from "@/lib/supabase-server"
import { redirect } from "next/navigation"

export async function resetPasswordAction(formData: FormData) {
  const password = String(formData.get("password") || "")
  if (password.length < 8) redirect("/reset?error=short")

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?error=reset") // sessão de recuperação ausente/expirada

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect("/reset?error=1")

  await supabase.auth.signOut() // encerra a sessão de recuperação; login fresco
  redirect("/login?reset=1")
}
