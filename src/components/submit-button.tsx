"use client"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className={cn("w-full", className)} disabled={pending}>
      {pending ? "Aguarde..." : children}
    </Button>
  )
}
