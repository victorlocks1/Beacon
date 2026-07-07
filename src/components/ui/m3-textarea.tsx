"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface Props extends Omit<React.ComponentProps<"textarea">, "placeholder"> {
  label: string
  /** Classe de fundo que "corta" a borda atrás do label (deve casar com o container). */
  labelBg?: string
}

// Material 3 — Outlined textarea com label flutuante (mesmo padrão do M3TextField).
export function M3Textarea({
  id,
  label,
  labelBg = "bg-background",
  className,
  ...props
}: Props) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          id={inputId}
          placeholder=" "
          className={cn(
            "peer w-full rounded-lg border border-outline bg-transparent px-4 py-3 text-base text-on-surface outline-none transition-[border-color,box-shadow] placeholder:text-transparent focus:border-primary focus:shadow-[inset_0_0_0_1px_var(--md-primary)]",
            className
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "pointer-events-none absolute left-3 top-3 px-1 text-base transition-all",
            labelBg,
            "text-on-surface-variant",
            "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:text-primary",
            "peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:-translate-y-1/2 peer-[&:not(:placeholder-shown)]:text-xs"
          )}
        >
          {label}
        </label>
      </div>
    </div>
  )
}
