import { createServerClient } from "@supabase/ssr"
import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

// Recebe o link do e-mail de redefinição, valida o token (verifyOtp) e cria a
// sessão de recuperação em cookie; depois redireciona para /reset.
//
// IMPORTANTE: os cookies da sessão são gravados DIRETO na resposta de redirect
// (mesmo padrão do middleware). Se usássemos `supabaseServer()` (cookies() do
// next/headers) + `NextResponse.redirect()` novo, os cookies da sessão de
// recuperação poderiam não chegar ao navegador — e o /reset acharia que não há
// sessão, jogando o usuário pro login com "link inválido".
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/reset"

  if (tokenHash && type) {
    const response = NextResponse.redirect(`${origin}${next}`)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options)
            }
          },
        },
      }
    )
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return response
  }
  return NextResponse.redirect(`${origin}/login?error=reset`)
}
