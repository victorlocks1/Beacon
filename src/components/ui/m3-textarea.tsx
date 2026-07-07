"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface Props extends Omit<React.ComponentProps<"textarea">, "placeholder"> {
  label: string
  /** Classe de fundo que "corta" a borda atrás do label (deve casar com o container). */
  labelBg?: string
}

// Material 3 — Outlined textarea com label flutuante (mesmo padrão do M3TextField).
// Cresce automaticamente conforme o usuário digita (sem scroll interno).
export function M3Textarea({
  id,
  label,
  labelBg = "bg-background",
  className,
  value,
  onChange,
  ...props
}: Props) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const ref = React.useRef<HTMLTextAreaElement | null>(null)

  const autoGrow = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // Reajusta ao montar e sempre que o valor mudar (uso controlado).
  React.useLayoutEffect(() => {
    autoGrow()
  }, [autoGrow, value])

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          id={inputId}
          ref={ref}
          rows={1}
          placeholder=" "
          value={value}
          onChange={(e) => {
            onChange?.(e)
            autoGrow()
          }}
          className={cn(
            "peer w-full resize-none overflow-hidden rounded-lg border border-outline bg-transparent px-4 py-3 text-base text-on-surface outline-none transition-[border-color,box-shadow] placeholder:text-transparent focus:border-primary focus:shadow-[inset_0_0_0_1px_var(--md-primary)]",
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
