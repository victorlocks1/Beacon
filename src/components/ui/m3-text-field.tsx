"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface Props extends Omit<React.ComponentProps<"input">, "placeholder"> {
  label: string
  error?: string
  /** Classe de fundo que "corta" a borda atrás do label (deve casar com o container). */
  labelBg?: string
}

// Material 3 — Outlined text field com label flutuante.
export function M3TextField({
  id,
  label,
  error,
  labelBg = "bg-background",
  className,
  ...props
}: Props) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={inputId}
          placeholder=" "
          className={cn(
            "peer h-14 w-full rounded-[4px] border bg-transparent px-4 text-base text-on-surface outline-none transition-[border-color,box-shadow] placeholder:text-transparent",
            error
              ? "border-error focus:border-error focus:shadow-[inset_0_0_0_1px_var(--md-error)]"
              : "border-outline focus:border-primary focus:shadow-[inset_0_0_0_1px_var(--md-primary)]",
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 px-1 text-base transition-all",
            labelBg,
            "text-on-surface-variant",
            "peer-focus:top-0 peer-focus:text-xs peer-focus:-translate-y-1/2",
            "peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:text-xs peer-[&:not(:placeholder-shown)]:-translate-y-1/2",
            error ? "peer-focus:text-error text-error" : "peer-focus:text-primary"
          )}
        >
          {label}
        </label>
      </div>
      {error && <p className="mt-1 px-4 text-xs text-error">{error}</p>}
    </div>
  )
}
