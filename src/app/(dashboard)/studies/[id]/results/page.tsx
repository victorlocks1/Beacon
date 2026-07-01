import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Users } from "lucide-react"
import { formatDuration, formatPct } from "@/lib/format"
import { ResetDataButton } from "@/components/study/reset-data-button"

export default async function ResultsOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const study = await prisma.study.findUnique({
    where: { id, ownerId: session.user.id },
    include: {
      blocks: {
        where: { type: "mission" },
        orderBy: { order: "asc" },
        include: { mission: true },
      },
      _count: { select: { sessions: true } },
    },
  })
  if (!study) notFound()

  const missions = study.blocks
    .map((b) => b.mission)
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const results = await prisma.missionResult.findMany({
    where: { session: { studyId: id } },
  })

  const finishedSessions = await prisma.session.count({
    where: { studyId: id, finishedAt: { not: null } },
  })

  const questions = await prisma.question.findMany({
    where: { block: { studyId: id } },
    orderBy: { block: { order: "asc" } },
    include: { answers: true },
  })

  function statsFor(missionId: string) {
    const rs = results.filter((r) => r.missionId === missionId)
    const total = rs.length
    const successes = rs.filter(
      (r) => r.outcome === "direct" || r.outcome === "indirect"
    ).length
    const totalClicks = rs.reduce((a, r) => a + r.clickCount, 0)
    const totalMisclicks = rs.reduce((a, r) => a + r.misclickCount, 0)
    const avgDuration = total
      ? rs.reduce((a, r) => a + r.durationMs, 0) / total
      : 0
    return {
      total,
      successRate: total ? (successes / total) * 100 : 0,
      misclickRate: totalClicks ? (totalMisclicks / totalClicks) * 100 : 0,
      avgDuration,
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/studies/${id}`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-headline-small text-on-surface">Resultados</h1>
          <p className="text-body-medium text-on-surface-variant mt-0.5">{study.title}</p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {study._count.sessions} sessão(ões) · {finishedSessions} concluída(s)
        </Badge>
        <ResetDataButton studyId={id} sessionCount={study._count.sessions} />
      </div>

      {missions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          Nenhuma missão neste study.
        </div>
      ) : (
        <div className="space-y-4">
          {missions.map((mission, index) => {
            const s = statsFor(mission.id)
            return (
              <Link
                key={mission.id}
                href={`/studies/${id}/results/${mission.id}`}
                className="block border border-outline-variant rounded-2xl p-6 bg-surface-container-low transition-shadow hover:elevation-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-label-medium text-on-surface-variant mb-1">
                      MISSÃO {index + 1}
                    </p>
                    <h2 className="text-title-medium text-on-surface truncate">{mission.task}</h2>
                  </div>
                  <ArrowRight className="h-4 w-4 text-on-surface-variant shrink-0 mt-1" />
                </div>

                {s.total === 0 ? (
                  <p className="text-body-medium text-on-surface-variant mt-4">
                    Ainda sem respostas.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-3 mt-6">
                    <Stat label="Respostas" value={String(s.total)} />
                    <Stat label="Sucesso" value={formatPct(s.successRate)} />
                    <Stat label="Misclick" value={formatPct(s.misclickRate)} />
                    <Stat label="Duração méd." value={formatDuration(s.avgDuration)} />
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-10">
          <h2 className="text-title-medium text-on-surface mb-4">Perguntas</h2>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionResultCard key={q.id} studyId={id} index={i} question={q} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const qTypeLabel: Record<string, string> = {
  open: "Aberta",
  choice: "Múltipla escolha",
  rating: "Estrelas",
  binary: "Sim / Não",
}

type QuestionWithAnswers = {
  id: string
  type: string
  title: string
  options: unknown
  answers: { text: string | null; choice: string | null; rating: number | null }[]
}

function QuestionResultCard({
  studyId,
  index,
  question,
}: {
  studyId: string
  index: number
  question: QuestionWithAnswers
}) {
  const answers = question.answers
  const options = (question.options as string[] | null) ?? []

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-label-medium text-on-surface-variant mb-1">
          PERGUNTA {index + 1} · {qTypeLabel[question.type]}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-title-large text-on-surface">{value}</p>
      <p className="text-body-small text-on-surface-variant mt-0.5">{label}</p>
    </div>
  )
}
