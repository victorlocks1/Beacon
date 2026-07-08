"use client"
import { cn } from "@/lib/utils"
import { SEQ_ANCHORS, type SumLang } from "@/lib/sum"

// Escala SEQ (Single Ease Question) 1..7 usada pela SUM. Uma linha de 7 botões
// com as âncoras (muito difícil ↔ muito fácil).
export function SeqScale({
  statement,
  value,
  onChange,
  lang,
}: {
  statement: string
  value: number
  onChange: (v: number) => void
  lang: SumLang
}) {
  const anchors = SEQ_ANCHORS[lang]
  return (
    <div className="space-y-2.5">
      <p className="text-title-medium text-on-surface">{statement}</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n}`}
            className={cn(
              "h-11 w-11 shrink-0 rounded-xl border-2 text-title-medium transition-colors",
              value === n
                ? "border-primary bg-primary/[0.06] text-on-surface"
                : "border-outline-variant text-on-surface-variant hover:border-on-surface-variant/50"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-body-small text-on-surface-variant max-w-[21rem]">
        <span>{anchors.low}</span>
        <span>{anchors.high}</span>
      </div>
    </div>
  )
}
