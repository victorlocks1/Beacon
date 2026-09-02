import { createBrowserClient } from "@supabase/ssr"

// Client do Supabase para o NAVEGADOR. Usado no fluxo de redefinição de senha,
// onde a sessão de recuperação vem no link do e-mail e é lida no cliente.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
