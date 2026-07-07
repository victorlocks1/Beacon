import Link from "next/link"
import { ArrowRight } from "lucide-react"

const qTypeLabel: Record<string, string> = {
  open: "Aberta",
  choice: "Múltipla escolha",
  rating: "Estrelas",
  binary: "Sim / Não",
}

export type QuestionWithAnswers = {
  id: string
  type: string
  title: string
  options: unknown
  mission?: { task: string } | null
  answers: { text: string | null; choice: string | null; rating: number | null }[]
}

// Card de resultado de uma pergunta: aberta (link p/ ver todas), estrelas (média
// + distribuição), escolha/binário (distribuição por opção). Usado na visão geral
// e dentro do detalhe da missão.
export function QuestionResultCard({
  studyId,
  index,
  question,
  hideMissionRef = false,
}: {
  studyId: string
  index: number
  question: QuestionWithAnswers
  hideMissionRef?: boolean
}) {
  const answers = question.answers
  const options = (question.options as string[] | null) ?? []

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-label-medium text-on-surface-variant mb-1">
          PERGUNTA {index + 1} · {qTypeLabel[question.type]}
          {!hideMissionRef && question.mission ? ` · sobre “${question.mission.task}”` : ""}
        </p>
        <h3 className="text-title-medium text-on-surface">{question.title}</h3>
      </div>
      {question.type === "open" && (
        <ArrowRight className="h-4 w-4 text-on-surface-variant shrink-0 mt-1" />
      )}
    </div>
  )

  const cardClass =
    "block border border-outline-variant rounded-2xl p-6 bg-surface-container-low"

  if (question.type === "open") {
    const texts = answers.filter((a) => a.text)
    return (
      <Link
        href={`/studies/${studyId}/results/question/${question.id}`}
        className={`${cardClass} transition-shadow hover:elevation-2`}
      >
        {header}
        <p className="text-body-medium text-on-surface-variant mt-4">
          {texts.length === 0 ? "Ainda sem respostas." : `${texts.length} resposta(s) — ver todas`}
        </p>
      </Link>
    )
  }

  if (question.type === "rating") {
    const rated = answers.map((a) => a.rating).filter((r): r is number => typeof r === "number")
    const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0
    return (
      <div className={cardClass}>
        {header}
        {rated.length === 0 ? (
          <p className="text-body-medium text-on-surface-variant mt-4">Ainda sem respostas.</p>
        ) : (
          <div className="mt-5 space-y-2">
            <p className="text-headline-small text-on-surface">
              {avg.toFixed(1)} <span className="text-body-medium text-on-surface-variant">/ 5 · {rated.length} resposta(s)</span>
            </p>
            {[5, 4, 3, 2, 1].map((star) => (
              <QBar key={star} label={`${star}★`} count={rated.filter((r) => r === star).length} total={rated.length} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // choice + binary → distribuição por opção
  const opts = question.type === "binary" ? ["yes", "no"] : options
  const optLabel: Record<string, string> = { yes: "Sim", no: "Não" }
  const chosen = answers.map((a) => a.choice).filter((c): c is string => !!c)
  return (
    <div className={cardClass}>
      {header}
      {chosen.length === 0 ? (
        <p className="text-body-medium text-on-surface-variant mt-4">Ainda sem respostas.</p>
      ) : (
        <div className="mt-5 space-y-2">
          <p className="text-body-small text-on-surface-variant">{chosen.length} resposta(s)</p>
          {opts.map((opt) => (
            <QBar
              key={opt}
              label={optLabel[opt] ?? opt}
              count={chosen.filter((c) => c === opt).length}
              total={chosen.length}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function QBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-body-small text-on-surface-variant truncate">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-body-small text-on-surface-variant">
        {count} · {pct}%
      </span>
    </div>
  )
}
