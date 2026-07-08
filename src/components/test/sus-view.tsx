"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ClipboardCheck } from "lucide-react"
import { SUS_STATEMENTS, SUS_OPTIONS, SUS_INTRO, SUS_ITEM_COUNT } from "@/lib/sus"
import { tt, type Lang } from "@/lib/i18n"

// Questionário SUS no testador: 10 afirmações fixas, escala de 5 pontos.
// Todas obrigatórias (padrão do método). Ao concluir, devolve os 10 valores 1..5.
export function SusView({
  lang,
  statements: customStatements,
  onSubmit,
}: {
  lang: Lang
  statements?: string[] // enunciados customizados; ausente = padrão do idioma
  onSubmit: (values: number[]) => void
}) {
  const s = tt(lang)
  const l = (lang === "es" ? "es" : "pt") as "pt" | "es"
  const statements =
    customStatements && customStatements.length === SUS_ITEM_COUNT ? customStatements : SUS_STATEMENTS[l]
  const options = SUS_OPTIONS[l]
  const intro = SUS_INTRO[l]
  const [values, setValues] = useState<(number | null)[]>(Array(SUS_ITEM_COUNT).fill(null))
  const [busy, setBusy] = useState(false)

  const allAnswered = values.every((v) => v != null)

  function set(i: number, v: number) {
    setValues((prev) => {
      const n = [...prev]
      n[i] = v
      return n
    })
  }

  function submit() {
    if (busy || !allAnswered) return
    setBusy(true)
    onSubmit(values as number[])
  }

  return (
    <div className="min-h-screen bg-surface-container flex items-start justify-center p-4 md:p-6">
      <div className="w-full max-w-xl my-6 space-y-5">
        <div className="rounded-[28px] bg-surface-container-low border border-outline-variant p-8 space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <h1 className="text-headline-small text-on-surface">{intro.title}</h1>
          <p className="text-body-medium text-on-surface-variant">{intro.body}</p>
        </div>

        {statements.map((st, i) => (
          <div key={i} className="rounded-2xl bg-surface-container-low border border-outline-variant p-6 space-y-4">
            <p className="text-title-small text-on-surface">
              <span className="text-on-surface-variant mr-1">{i + 1}.</span>
              {st}
            </p>
            <div className="space-y-2">
              {options.map((opt, oi) => {
                const val = oi + 1
                const active = values[i] === val
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => set(i, val)}
                    className={cn(
                      "w-full text-left rounded-xl border-2 px-4 py-2.5 text-body-medium transition-colors flex items-center gap-3",
                      active
                        ? "border-primary bg-primary/[0.04] text-on-surface"
                        : "border-outline-variant text-on-surface hover:border-on-surface-variant/50"
                    )}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full border-2 shrink-0",
                        active ? "border-primary bg-primary" : "border-outline-variant"
                      )}
                    />
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end pb-6">
          <Button onClick={submit} disabled={!allAnswered || busy} className="h-12 px-8" size="lg">
            {s.continue}
          </Button>
        </div>
      </div>
    </div>
  )
}
