import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Middleware do Supabase Auth: renova o token da sessão a cada request e mantém
// os cookies sincronizados. NÃO bloqueia rotas (o gate continua sendo por página
// via `auth()`), então as rotas públicas do testador (/t/...) seguem abertas.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Necessário: aciona o refresh do token e a gravação dos cookies atualizados.
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    // tudo, menos assets estáticos, imagens e as rotas PÚBLICAS do testador
    // (/t/... e /api/t/...): elas não usam login, então não precisam renovar a
    // sessão a cada evento enviado durante o teste.
    "/((?!_next/static|_next/image|favicon.ico|t/|api/t/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
