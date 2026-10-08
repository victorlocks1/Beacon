"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { HelpCircle, Star } from "lucide-react"
import { tt, type Lang } from "@/lib/i18n"
import { deviceMaxWidth, type DeviceType } from "@/lib/device"

export type StepQuestion = {
  id: string
  type: "open" | "choice" | "rating" | "binary"
  title: string
  description: string | null
  required: boolean
  options: string[]
  // tela do protótipo exibida junto com a pergunta (opcional)
  screen?: { name: string; imageUrl: string } | null
}

export type AnswerPayload = { text?: string; choice?: string; rating?: number }

export function QuestionView({
  question,
  lang,
  stepLabel,
  onSubmit,
  deviceType = "desktop",
}: {
  deviceType?: DeviceType // dispositivo do estudo: largura em que a tela é exibida
  question: StepQuestion
  lang: Lang
  stepLabel: string
  onSubmit: (payload: AnswerPayload) => void
}) {
  const s = tt(lang)
  const [text, setText] = useState("")
  const [choice, setChoice] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [busy, setBusy] = useState(false)

  const answered =
    question.type === "open"
      ? text.trim().length > 0
      : question.type === "rating"
        ? rating > 0
        : !!choice // choice / binary

  const canContinue = !question.required || answered

  function submit(skip = false) {
    if (busy) return
    setBusy(true)
    if (skip) {
      onSubmit({})
      return
    }
    if (question.type === "open") onSubmit({ text: text.trim() })
    else if (question.type === "rating") onSubmit({ rating })
    else onSubmit({ choice: choice ?? "" })
  }

  const card = (
    <div className="w-full max-w-lg rounded-[28px] bg-surface-container-low border border-outline-variant p-8 space-y-6">
      <div className="flex items-center gap-2 text-label-large text-on-surface-variant">
        <HelpCircle className="h-4 w-4" />
        {stepLabel}
      </div>

      <div className="space-y-1.5">
        <h1 className="text-headline-small text-on-surface">{question.title}</h1>
        {question.description && (
          <p className="text-body-medium text-on-surface-variant">{question.description}</p>
        )}
      </div>

      {/* Entrada por tipo */}
      {question.type === "open" && (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={s.openPlaceholder}
          className="rounded-lg min-h-32"
          autoFocus
        />
      )}

      {question.type === "choice" && (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setChoice(opt)}
              className={cn(
                "w-full text-left rounded-2xl border-2 px-4 py-3 text-body-large transition-colors",
                choice === opt
                  ? "border-primary bg-primary/[0.04] text-on-surface"
                  : "border-outline-variant text-on-surface hover:border-on-surface-variant/50"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === "rating" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n}`}
                className="p-1"
              >
                <Star
                  className={cn(
                    "h-12 w-12 transition-colors",
                    n <= rating ? "text-amber-400" : "text-outline-variant"
                  )}
                  fill={n <= rating ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
          <p className="text-body-small text-on-surface-variant">{s.rateHint}</p>
        </div>
      )}

      {question.type === "binary" && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "yes", label: s.yes },
            { v: "no", label: s.no },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setChoice(o.v)}
              className={cn(
                "rounded-2xl border-2 py-4 text-title-medium transition-colors",
                choice === o.v
                  ? "border-primary bg-primary/[0.04] text-on-surface"
                  : "border-outline-variant text-on-surface hover:border-on-surface-variant/50"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {!question.required ? (
          <button
            type="button"
            onClick={() => submit(true)}
            className="text-body-medium text-on-surface-variant hover:underline"
          >
            {s.skip}
          </button>
        ) : (
          <span />
        )}
        <Button onClick={() => submit(false)} disabled={!canContinue || busy} className="h-12 px-8" size="lg">
          {s.continue}
        </Button>
      </div>
    </div>
  )

  // Sem tela (ou tela ainda sem imagem): só o cartão da pergunta, como sempre.
  const screen = question.screen?.imageUrl ? question.screen : null
  if (!screen) return card

  // Pergunta sobre uma tela: a tela e a pergunta ficam SEMPRE visíveis juntas.
  // Telas largas: tela à esquerda (rola por dentro se for longa) e a pergunta
  // fixa à direita. Telas estreitas: tela em cima, pergunta embaixo.
  return (
    <div className="w-full max-w-7xl flex flex-col lg:flex-row lg:items-start lg:justify-center gap-6">
      <div className="min-w-0 lg:flex-1 flex justify-center">
        <div
          className="w-full max-h-[45vh] lg:max-h-[88vh] overflow-auto subtle-scroll rounded-2xl border border-outline-variant bg-white shadow-sm"
          style={{ maxWidth: deviceMaxWidth[deviceType] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screen.imageUrl}
            alt={screen.name}
            className="w-full h-auto block select-none"
            draggable={false}
          />
        </div>
      </div>
      <div className="w-full lg:w-[28rem] lg:shrink-0 lg:sticky lg:top-6 flex justify-center">{card}</div>
    </div>
  )
}
