import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDuration, formatPct } from "@/lib/format"
import { ResetDataButton } from "@/components/study/reset-data-button"
import { MetricInfo } from "@/components/results/metric-info"
import { QuestionResultCard } from "@/components/results/question-result-card"
import { FigmaImagesAutoLoad } from "@/components/results/load-figma-images-button"

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

  // Telas do Figma ainda sem imagem (import ao vivo) — para o botão de heatmap.
  const screensMissingImage = await prisma.screen.count({
    where: { prototype: { studyId: id }, imageUrl: "" },
  })

  const finishedSessions = await prisma.session.count({
    where: { studyId: id, finishedAt: { not: null } },
  })

  // Sessões encerradas de fato (finishedAt OU inativas além do timeout) — mesma
  // regra da página de detalhe. Necessário para o denominador correto da taxa de
  // conclusão: incluir as PERDIDAS (não só quem tem MissionResult).
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000
  const nowMs = Date.now()
  const studySessions = await prisma.session.findMany({
    where: { studyId: id },
    select: { id: true, startedAt: true, finishedAt: true },
  })
  const sessionEnded = new Map(
    studySessions.map((s) => [
      s.id,
      s.finishedAt != null || nowMs - s.startedAt.getTime() > SESSION_TIMEOUT_MS,
    ])
  )
  // Quem INICIOU cada missão (tem evento) — base da classificação por sessão.
  const startEvents = await prisma.event.findMany({
    where: { session: { studyId: id } },
    select: { missionId: true, sessionId: true },
  })
  const startedByMission = new Map<string, Set<string>>()
  for (const e of startEvents) {
    if (!e.missionId) continue
    const set = startedByMission.get(e.missionId) ?? new Set<string>()
    set.add(e.sessionId)
    startedByMission.set(e.missionId, set)
  }

  const questionsRaw = await prisma.question.findMany({
    where: {
      OR: [{ block: { studyId: id } }, { mission: { block: { studyId: id } } }],
    },
    include: {
      answers: true,
      block: { select: { order: true } },
      mission: { select: { task: true, block: { select: { order: true } } } },
    },
  })
  // Ordena pela posição do bloco (missão ou pergunta geral) e, dentro da
  // missão, pela ordem da pergunta.
  const questions = [...questionsRaw].sort((a, b) => {
    const ao = a.block?.order ?? a.mission?.block.order ?? 0
    const bo = b.block?.order ?? b.mission?.block.order ?? 0
    return ao - bo || a.order - b.order
  })
  // Livres = criadas fora de missão (têm bloco próprio); as de missão aparecem
  // dentro do detalhe da missão correspondente.
  const freeQuestions = questions.filter((q) => !q.missionId)

  function statsFor(missionId: string) {
    const rs = results.filter((r) => r.missionId === missionId)
    const resultBySession = new Map(rs.map((r) => [r.sessionId, r]))
    const started = startedByMission.get(missionId) ?? new Set<string>()

    // Sucesso = "direct" (tela-alvo, ou caminho exato seguido fielmente).
    // "indirect" (chegou fora do caminho exato) NÃO é sucesso, mas segue no
    // denominador — assim a taxa de conclusão reflete o caminho exato.
    let completed = 0, indirect = 0, declared = 0, lost = 0
    for (const sid of started) {
      const r = resultBySession.get(sid)
      if (r && r.outcome === "direct") completed++
      else if (r && r.outcome === "indirect") indirect++
      else if (r && r.outcome === "given_up") declared++
      else if (sessionEnded.get(sid)) lost++
    }
    const ended = completed + indirect + declared + lost

    const totalClicks = rs.reduce((a, r) => a + r.clickCount, 0)
    const totalMisclicks = rs.reduce((a, r) => a + r.misclickCount, 0)
    const avgDuration = rs.length
      ? rs.reduce((a, r) => a + r.durationMs, 0) / rs.length
      : 0
    return {
      started: started.size,
      completionRate: ended ? (completed / ended) * 100 : 0,
      lostRate: ended ? (lost / ended) * 100 : 0,
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
        {screensMissingImage > 0 && (
          <FigmaImagesAutoLoad studyId={id} pending={screensMissingImage} />
        )}
        <ResetDataButton studyId={id} sessionCount={study._count.sessions} />
      </div>

      <Tabs defaultValue="missions">
        <TabsList className="mb-6">
          <TabsTrigger value="missions">Missões ({missions.length})</TabsTrigger>
          <TabsTrigger value="questions">Perguntas ({freeQuestions.length})</TabsTrigger>
        </TabsList>

        {/* ── Missões (cada uma com suas perguntas de acompanhamento) ── */}
        <TabsContent value="missions">
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
                      className="block border border-black/10 rounded-2xl p-6 bg-white transition-shadow hover:elevation-2"
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

                      {s.started === 0 ? (
                        <p className="text-body-medium text-on-surface-variant mt-4">
                          Ainda sem respostas.
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-3 mt-6">
                          <Stat
                            label="Conclusão"
                            value={formatPct(s.completionRate)}
                            info="Sucesso da tarefa sobre as sessões encerradas. No critério de caminho exato, só conta quem seguiu FIELMENTE o caminho definido — chegar na tela final por outro caminho não conta como conclusão (veja 'Caminho indireto' no detalhe da missão)."
                          />
                          <Stat
                            label="Perdida"
                            value={formatPct(s.lostRate)}
                            info="Abandono silencioso: iniciou a tarefa mas não concluiu nem desistiu, e a sessão foi encerrada (fim do teste ou inatividade > 30 min)."
                          />
                          <Stat
                            label="Misclick"
                            value={formatPct(s.misclickRate)}
                            info="Percentual de cliques fora de uma área clicável (erro de alvo), sobre o total de cliques."
                          />
                          <Stat
                            label="Duração méd."
                            value={formatDuration(s.avgDuration)}
                            info="Tempo médio da tarefa (início até concluir/desistir), só das sessões com resultado."
                          />
                        </div>
                      )}
                    </Link>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Perguntas livres (criadas fora de missão) ── */}
        <TabsContent value="questions">
          {freeQuestions.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
              Nenhuma pergunta avulsa. Perguntas criadas dentro de uma missão aparecem na aba Missões.
            </div>
          ) : (
            <div className="space-y-4">
              {freeQuestions.map((q, i) => (
                <QuestionResultCard key={q.id} studyId={id} index={i} question={q} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div>
      <p className="text-title-large text-on-surface">{value}</p>
      <p className="text-body-small text-on-surface-variant mt-0.5 flex items-center gap-1">
        {label}
        {info && <MetricInfo text={info} />}
      </p>
    </div>
  )
}
