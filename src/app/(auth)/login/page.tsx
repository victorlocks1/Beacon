import Link from "next/link"
import { loginAction } from "./actions"
import { M3TextField } from "@/components/ui/m3-text-field"
import { SubmitButton } from "@/components/submit-button"
import { AuthForm } from "@/components/auth-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-sm rounded-[28px] bg-surface-container-low elevation-2 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary text-2xl font-medium">
            B
          </div>
          <h1 className="text-headline-small text-on-surface">Beacon</h1>
          <p className="text-body-medium text-on-surface-variant mt-1">
            Acesse sua conta
          </p>
        </div>

        <AuthForm action={loginAction} className="space-y-5">
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
            autoComplete="current-password"
            labelBg="bg-surface-container-low"
            required
          />
          {error === "credentials" && (
            <p className="text-body-small text-error px-1">
              Email ou senha incorretos.
            </p>
          )}
          <SubmitButton className="w-full">Entrar</SubmitButton>
        </AuthForm>

        <p className="text-body-medium text-on-surface-variant text-center mt-6">
          Não tem conta?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
