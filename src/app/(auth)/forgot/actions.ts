"use server"
import { supabaseServer } from "@/lib/supabase-server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

// Envia o e-mail de redefinição. Sempre responde "enviado" (não revela se o
// e-mail existe) para evitar enumeração de contas.
export async function forgotAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  if (email) {
    const supabase = await supabaseServer()
    const h = await headers()
    const origin = h.get("origin") ?? `https://${h.get("host")}`
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/reset`,
    })
  }
  redirect("/forgot?sent=1")
}
