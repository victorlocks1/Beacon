import Link from "next/link"
import { registerAction } from "./actions"
import { M3TextField } from "@/components/ui/m3-text-field"
import { SubmitButton } from "@/components/submit-button"
import { AuthForm } from "@/components/auth-form"

const errorMessages: Record<string, string> = {
  taken: "Este email já está em uso.",
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMsg = error
    ? (errorMessages[error] ?? decodeURIComponent(error))
    : undefined

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-sm rounded-[28px] bg-surface-container-low elevation-2 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary text-2xl font-medium">
            B
          </div>
          <h1 className="text-headline-small text-on-surface">Beacon</h1>
          <p className="text-body-medium text-on-surface-variant mt-1">
            Criar nova conta
          </p>
        </div>

        <AuthForm action={registerAction} className="space-y-5">
          <M3TextField label="Nome" name="name" autoComplete="name" labelBg="bg-surface-container-low" required />
          <M3TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            labelBg="bg-surface-container-low"
            required
          />
          <M3TextField
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            labelBg="bg-surface-container-low"
            required
          />
          {errorMsg && (
            <p className="text-body-small text-error px-1">{errorMsg}</p>
          )}
          <SubmitButton className="w-full">Criar conta</SubmitButton>
        </AuthForm>

        <p className="text-body-medium text-on-surface-variant text-center mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
