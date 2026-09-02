import Link from "next/link"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase-server"
import { resetPasswordAction } from "./actions"
import { M3TextField } from "@/components/ui/m3-text-field"
import { SubmitButton } from "@/components/submit-button"
import { AuthForm } from "@/components/auth-form"

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  // Só chega aqui com a sessão de recuperação (criada por /auth/confirm).
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?error=reset")

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-sm rounded-[28px] bg-surface-container-low elevation-2 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary text-2xl font-medium">
            B
          </div>
          <h1 className="text-headline-small text-on-surface">Nova senha</h1>
          <p className="text-body-medium text-on-surface-variant mt-1">
            Defina a nova senha da sua conta
          </p>
        </div>

        <AuthForm action={resetPasswordAction} className="space-y-5">
          <M3TextField
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            labelBg="bg-surface-container-low"
            required
          />
          {error === "short" && (
            <p className="text-body-small text-error px-1">
              A senha deve ter pelo menos 8 caracteres.
            </p>
          )}
          {error === "1" && (
            <p className="text-body-small text-error px-1">
              Não foi possível redefinir. Tente pedir um novo link.
            </p>
          )}
          <SubmitButton className="w-full">Salvar nova senha</SubmitButton>
        </AuthForm>

        <p className="text-body-medium text-on-surface-variant text-center mt-6">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
