import Link from "next/link"
import { forgotAction } from "./actions"
import { M3TextField } from "@/components/ui/m3-text-field"
import { SubmitButton } from "@/components/submit-button"
import { AuthForm } from "@/components/auth-form"

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const { sent } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-sm rounded-[28px] bg-surface-container-low elevation-2 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary text-2xl font-medium">
            B
          </div>
          <h1 className="text-headline-small text-on-surface">Recuperar senha</h1>
          <p className="text-body-medium text-on-surface-variant mt-1">
            Enviaremos um link para você redefinir
          </p>
        </div>

        {sent ? (
          <p className="text-body-medium text-on-surface-variant text-center">
            Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.
            Verifique sua caixa de entrada (e o spam).
          </p>
        ) : (
          <AuthForm action={forgotAction} className="space-y-5">
            <M3TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              labelBg="bg-surface-container-low"
              required
            />
            <SubmitButton className="w-full">Enviar link</SubmitButton>
          </AuthForm>
        )}

        <p className="text-body-medium text-on-surface-variant text-center mt-6">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
