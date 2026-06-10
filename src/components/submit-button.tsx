"use client"
import { useFormStatus } from "react-dom"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Botão de submit NATIVO (garante Enter + clique submetendo o form).
export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(buttonVariants(), "w-full", className)}
    >
      {pending ? "Aguarde..." : children}
    </button>
  )
}
