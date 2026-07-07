"use client"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import type { VariantProps } from "class-variance-authority"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Variants = VariantProps<typeof buttonVariants>

// Botão de submit NATIVO (garante Enter + clique submetendo o form) com estado
// de "carregando" automático (useFormStatus): fica desabilitado e troca o
// conteúdo por um spinner enquanto a Server Action roda. Evita a sensação de
// "não respondeu" que leva o usuário a clicar 2x.
export function SubmitButton({
  children,
  className,
  variant,
  size,
  fullWidth = true,
  disabled = false,
}: {
  children: React.ReactNode
  className?: string
  variant?: Variants["variant"]
  size?: Variants["size"]
  fullWidth?: boolean
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(buttonVariants({ variant, size }), fullWidth && "w-full", className)}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}
