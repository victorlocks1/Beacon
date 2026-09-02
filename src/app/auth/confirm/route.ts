import { supabaseServer } from "@/lib/supabase-server"
import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

// Recebe o link do e-mail de redefinição, valida o token (verifyOtp) e cria a
// sessão de recuperação em cookie; depois redireciona para /reset.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/reset"

  if (tokenHash && type) {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=reset`)
}
