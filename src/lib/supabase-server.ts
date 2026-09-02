import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Client do Supabase para o SERVIDOR (Server Components, Server Actions, Route
// Handlers). A sessão vive em cookies HttpOnly, gerenciados aqui. O refresh do
// token é feito no middleware.
export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Chamado de um Server Component (não pode escrever cookie): o
            // middleware cuida do refresh da sessão. Ignorar com segurança.
          }
        },
      },
    }
  )
}
