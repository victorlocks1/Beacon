"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { HelpCircle, Star } from "lucide-react"
import { tt, type Lang } from "@/lib/i18n"

export type StepQuestion = {
  id: string
  type: "open" | "choice" | "rating" | "binary"
  title: string
  description: string | null
  required: boolean
  options: string[]
}

export type AnswerPayload = { text?: string; choice?: string; rating?: number }

export function QuestionView({
  question,
  lang,
  stepLabel,
  onSubmit,
}: {
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

  return (
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
}
