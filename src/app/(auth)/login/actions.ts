"use server"
import { supabaseServer } from "@/lib/supabase-server"
import { redirect } from "next/navigation"

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect("/login?error=credentials")

  redirect("/projects")
}
