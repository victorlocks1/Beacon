import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { formatDuration, formatPct } from "@/lib/format"
import { reconstructPath } from "@/lib/path"
import { HeatmapViewer } from "@/components/results/heatmap-viewer"
import { MetricInfo } from "@/components/results/metric-info"
import { QuestionResultCard } from "@/components/results/question-result-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FigmaImagesAutoLoad } from "@/components/results/load-figma-images-button"

const outcomeBucket: Record<string, "direct" | "indirect" | "unfinished"> = {
  direct: "direct",
  indirect: "indirect",
  unfinished: "unfinished",
  given_up: "unfinished",
}
const bucketLabel = {
  direct: "Direto",
  indirect: "Indireto",
  unfinished: "Não concluído",
}
const bucketColor: Record<string, "default" | "secondary" | "outline"> = {
  direct: "default",
  indirect: "secondary",
  unfinished: "outline",
}

export default async function MissionResultsPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>
}) {
  const { id, missionId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const mission = await prisma.mission.findFirst({
    where: { id: missionId, block: { study: { id, ownerId: session.user.id } } },
    include: {
      questions: { orderBy: { order: "asc" }, include: { answers: true } },
      block: {
        include: {
          study: {
            include: {
              prototype: {
                include: { screens: { orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  })
  if (!mission) notFound()

  const study = mission.block.study
  const deviceType = (study.deviceType ?? "desktop") as
    | "desktop"
    | "tablet"
    | "mobile"
  const screens = study.prototype?.screens ?? []
  const screenById = new Map(screens.map((s) => [s.id, s]))
  // telas do Figma ainda sem imagem (import ao vivo) → auto-carrega o fundo
  const screensMissingImage = screens.filter((sc) => !sc.imageUrl).length

  const results = await prisma.missionResult.findMany({
    where: { missionId, session: { studyId: id } },
    include: { session: true },
    orderBy: { session: { startedAt: "asc" } },
  })

  // Numeração estável "Testador N" por ordem de chegada no study
  const studySessions = await prisma.session.findMany({
    where: { studyId: id },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, finishedAt: true },
  })
  const testerNumber = new Map(studySessions.map((s, i) => [s.id, i + 1]))

  // Sessão "encerrada de fato": concluiu o teste (finishedAt) OU está inativa
  // há mais que o timeout. Enquanto viva e sem timeout, a tarefa fica "em aberto"
  // (não conta como perdida) — evita falso positivo de quem ainda está fazendo.
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000
  const nowMs = Date.now()
  const sessionEnded = new Map(
    studySessions.map((s) => [
      s.id,
      s.finishedAt != null || nowMs - s.startedAt.getTime() > SESSION_TIMEOUT_MS,
    ])
  )

  const events = await prisma.event.findMany({
    where: { missionId, session: { studyId: id } },
    orderBy: { timestampMs: "asc" },
  })

  // ── Classificação por sessão que INICIOU a tarefa (exclusão em ordem) ──
  // 1) concluída (resultado direct/indirect) 2) declarada (given_up)
  // 3) perdida (iniciou, sem resultado, e sessão encerrada) — o resto fica "em aberto".
  const startedSessionIds = new Set(events.map((e) => e.sessionId))
  const resultBySession = new Map(results.map((r) => [r.sessionId, r]))

  // Sucesso = "direct" (tela-alvo alcançada OU, no caminho exato, caminho seguido
  // fielmente). "indirect" (chegou na tela final por outro caminho) NÃO é sucesso
  // no caminho exato — vira sua própria categoria, mas segue no denominador.
  type TaskState = "completed" | "indirect" | "declared" | "lost" | "open"
  const stateBySession = new Map<string, TaskState>()
  for (const sid of startedSessionIds) {
    const r = resultBySession.get(sid)
    if (r && r.outcome === "direct") stateBySession.set(sid, "completed")
    else if (r && r.outcome === "indirect") stateBySession.set(sid, "indirect")
    else if (r && r.outcome === "given_up") stateBySession.set(sid, "declared")
    else if (sessionEnded.get(sid)) stateBySession.set(sid, "lost")
    else stateBySession.set(sid, "open")
  }
  const counts = { completed: 0, indirect: 0, declared: 0, lost: 0, open: 0 }
  for (const st of stateBySession.values()) counts[st]++
  // As taxas somam 100% sobre as sessões ENCERRADAS (concluída + indireta +
  // declarada + perdida).
  const ended = counts.completed + counts.indirect + counts.declared + counts.lost
  const completionRate = ended ? (counts.completed / ended) * 100 : 0
  const indirectRate = ended ? (counts.indirect / ended) * 100 : 0
  const declaredRate = ended ? (counts.declared / ended) * 100 : 0
  const lostRate = ended ? (counts.lost / ended) * 100 : 0
  const isPath = mission.successType === "path"

  // Esforço (sobre quem tem resultado registrado)
  const withResult = results.length
  const totalClicks = results.reduce((a, r) => a + r.clickCount, 0)
  const totalMisclicks = results.reduce((a, r) => a + r.misclickCount, 0)
  const misclickRate = totalClicks ? (totalMisclicks / totalClicks) * 100 : 0
  const avgDuration = withResult ? results.reduce((a, r) => a + r.durationMs, 0) / withResult : 0

  // ── Primeiro clique: 1 por participante, o mais antigo por timestamp (travado).
  //    Retornos à mesma tela NÃO geram novo primeiro clique. ──
  const firstClickBySession = new Map<string, { screenId: string; x: number; y: number; tMs: number }>()
  for (const e of events) {
    if (e.type !== "click" && e.type !== "misclick") continue
    if (!firstClickBySession.has(e.sessionId)) {
      firstClickBySession.set(e.sessionId, {
        screenId: e.screenId,
        x: e.xNorm,
        y: e.yNorm,
        tMs: Number(e.timestampMs),
      })
    }
  }
  const firstClickByScreen = new Map<string, { x: number; y: number; type: "click" }[]>()
  for (const fc of firstClickBySession.values()) {
    const arr = firstClickByScreen.get(fc.screenId) ?? []
    arr.push({ x: fc.x, y: fc.y, type: "click" })
    firstClickByScreen.set(fc.screenId, arr)
  }

  // ── Tempo até o 1º toque: média só de quem clicou; reporta quantos nunca clicaram ──
  const firstTaps = [...firstClickBySession.values()].map((fc) => fc.tMs)
  const clickers = firstTaps.length
  const neverClicked = startedSessionIds.size - clickers
  const avgFirstTap = clickers ? firstTaps.reduce((a, b) => a + b, 0) / clickers : 0

  // ── Abandono: tela onde DESISTIU (escolha) e ÚLTIMA tela vista das perdidas (inferência) ──
  const giveUpByScreen = new Map<string, number>()
  for (const e of events) if (e.type === "give_up") giveUpByScreen.set(e.screenId, (giveUpByScreen.get(e.screenId) ?? 0) + 1)
  const lastScreenBySession = new Map<string, string>()
  for (const e of events) lastScreenBySession.set(e.sessionId, e.screenId) // eventos em ordem asc → última = mais recente
  const lostLastScreen = new Map<string, number>()
  for (const [sid, st] of stateBySession) {
    if (st !== "lost") continue
    const sc = lastScreenBySession.get(sid)
    if (sc) lostLastScreen.set(sc, (lostLastScreen.get(sc) ?? 0) + 1)
  }
  const nameOf = (sid: string) => screenById.get(sid)?.name ?? "?"
  const giveUpRows = [...giveUpByScreen.entries()].sort((a, b) => b[1] - a[1])
  const lostRows = [...lostLastScreen.entries()].sort((a, b) => b[1] - a[1])

  // ── Pontos por tela (heatmap) ──
  const pointsByScreen = new Map<string, { x: number; y: number; type: "click" | "misclick" }[]>()
  for (const e of events) {
    if (e.type !== "click" && e.type !== "misclick") continue
    const arr = pointsByScreen.get(e.screenId) ?? []
    arr.push({ x: e.xNorm, y: e.yNorm, type: e.type })
    pointsByScreen.set(e.screenId, arr)
  }
  const heatmapScreens = screens
    .filter((s) => pointsByScreen.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      imageUrl: s.imageUrl,
      points: pointsByScreen.get(s.id)!,
      firstClickPoints: firstClickByScreen.get(s.id) ?? [],
    }))

  // ── Caminho por sessão (computado uma vez) ──
  const startScreenId = mission.startScreenId
  const navsBySession = new Map<string, { targetScreenId: string | null }[]>()
  for (const e of events) {
    if (e.type !== "navigate") continue
    const arr = navsBySession.get(e.sessionId) ?? []
    arr.push({ targetScreenId: e.targetScreenId })
    navsBySession.set(e.sessionId, arr)
  }
  const pathCache = new Map<string, string[]>()
  function pathFor(sessionId: string): string[] {
    const cached = pathCache.get(sessionId)
    if (cached) return cached
    const path = reconstructPath(navsBySession.get(sessionId) ?? [])
    if (path.length === 0) path.push(startScreenId)
    pathCache.set(sessionId, path)
    return path
  }

  // ── Agrupar caminhos por desfecho ──
  type PathGroup = {
    bucket: "direct" | "indirect" | "unfinished"
    path: string[]
    count: number
    totalDuration: number
  }
  const groupMap = new Map<string, PathGroup>()
  for (const r of results) {
    const bucket = outcomeBucket[r.outcome]
    const path = pathFor(r.sessionId)
    const key = `${bucket}|${path.join(">")}`
    const g = groupMap.get(key)
    if (g) {
      g.count++
      g.totalDuration += r.durationMs
    } else {
      groupMap.set(key, { bucket, path, count: 1, totalDuration: r.durationMs })
    }
  }
  const bucketOrder = { direct: 0, indirect: 1, unfinished: 2 }
  const pathGroups = [...groupMap.values()].sort(
    (a, b) => bucketOrder[a.bucket] - bucketOrder[b.bucket] || b.count - a.count
  )

  // ── Sessões individuais ──
  const sessionRows = results.map((r) => {
    const path = pathFor(r.sessionId)
    return {
      id: r.sessionId,
      label: `Testador ${testerNumber.get(r.sessionId) ?? "?"}`,
      outcome: r.outcome,
      bucket: outcomeBucket[r.outcome],
      durationMs: r.durationMs,
      misclickCount: r.misclickCount,
      thumbs: path
        .slice(0, 4)
        .map((sid) => screenById.get(sid)?.imageUrl)
        .filter((u): u is string => !!u),
    }
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/studies/${id}/results`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-label-medium text-on-surface-variant">RESULTADOS DA MISSÃO</p>
          <h1 className="text-headline-small text-on-surface truncate">{mission.task}</h1>
        </div>
        {screensMissingImage > 0 && (
          <FigmaImagesAutoLoad studyId={id} pending={screensMissingImage} />
        )}
      </div>

      <Tabs defaultValue="geral">
        {mission.questions.length > 0 && (
          <TabsList className="mb-6">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="questions">
              Perguntas realizadas ({mission.questions.length})
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="geral">
      {startedSessionIds.size === 0 ? (
        <div className="text-center py-24 border border-outline-variant rounded-3xl bg-surface-container-low">
          <p className="text-title-medium text-on-surface">Ainda sem respostas</p>
          <p className="text-body-medium text-on-surface-variant mt-1.5">
            Compartilhe o link do teste para começar a coletar dados.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Desfecho — as taxas somam 100% das sessões encerradas */}
          <div>
            <div className={"grid gap-3 " + (isPath ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3")}>
              <Kpi
                label="Conclusão"
                value={formatPct(completionRate)}
                sub={`${counts.completed} de ${ended}`}
                info={
                  isPath
                    ? "Sucesso no caminho exato: participantes que seguiram FIELMENTE o caminho esperado até a tela final. Chegar por outro caminho conta como 'Caminho indireto', não como conclusão. Denominador = sessões encerradas."
                    : "Percentual de participantes que chegaram na tela-objetivo da tarefa. Denominador = sessões encerradas (concluídas + desistências + perdidas)."
                }
              />
              {isPath && (
                <Kpi
                  label="Caminho indireto"
                  value={formatPct(indirectRate)}
                  sub={`${counts.indirect} de ${ended}`}
                  info="Chegou na tela final, mas NÃO pelo caminho exato definido. No caminho exato isso não conta como sucesso."
                />
              )}
              <Kpi
                label="Desistência declarada"
                value={formatPct(declaredRate)}
                sub={`${counts.declared} de ${ended}`}
                info="Participantes que clicaram em 'Desistir' — declararam que não conseguiram concluir a tarefa."
              />
              <Kpi
                label="Perdida"
                value={formatPct(lostRate)}
                sub={`${counts.lost} de ${ended}`}
                info="Abandono silencioso: iniciou a tarefa mas não concluiu nem desistiu, e a sessão foi encerrada (fim do teste ou inatividade acima de 30 min)."
              />
            </div>
            {counts.open > 0 && (
              <p className="text-body-small text-on-surface-variant mt-2">
                {counts.open} sessão(ões) ainda em aberto (não encerradas) — fora do cálculo.
              </p>
            )}
          </div>

          {/* Esforço */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              label="Duração média"
              value={formatDuration(avgDuration)}
              info="Tempo médio da tarefa, do início (Iniciar tarefa) até concluir ou desistir. Considera só as sessões com resultado."
            />
            <Kpi
              label="Tempo até 1º toque"
              value={clickers ? formatDuration(avgFirstTap) : "—"}
              sub={clickers ? `méd. de ${clickers}` : "sem cliques"}
              info="Tempo do início da tarefa até o primeiro clique do participante. Média apenas de quem clicou (quem nunca clicou é reportado à parte)."
            />
            <Kpi
              label="Nunca clicaram"
              value={String(neverClicked)}
              sub="não têm 1º toque"
              info="Quantos participantes iniciaram a tarefa e não deram nenhum clique. Não entram na média de tempo até o 1º toque."
            />
            <Kpi
              label="Misclick rate"
              value={formatPct(misclickRate)}
              info="Percentual de cliques que caíram fora de uma área clicável (erro de alvo), sobre o total de cliques."
            />
          </div>

          {/* Tela do abandono */}
          {(giveUpRows.length > 0 || lostRows.length > 0) && (
            <section>
              <h2 className="text-title-large text-on-surface mb-4">Onde as pessoas abandonam</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-outline-variant rounded-2xl p-4 bg-surface-container-low">
                  <p className="text-title-small text-on-surface mb-2">Desistiu (declarado)</p>
                  {giveUpRows.length === 0 ? (
                    <p className="text-body-small text-on-surface-variant">Nenhuma desistência declarada.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {giveUpRows.map(([sid, n]) => (
                        <div key={sid} className="flex items-center justify-between text-body-medium">
                          <span className="text-on-surface truncate">{nameOf(sid)}</span>
                          <span className="text-on-surface-variant">{n}×</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border border-outline-variant rounded-2xl p-4 bg-surface-container-low">
                  <p className="text-title-small text-on-surface mb-2">Última tela vista (perdidas)</p>
                  {lostRows.length === 0 ? (
                    <p className="text-body-small text-on-surface-variant">Nenhuma sessão perdida.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lostRows.map(([sid, n]) => (
                        <div key={sid} className="flex items-center justify-between text-body-medium">
                          <span className="text-on-surface truncate">{nameOf(sid)}</span>
                          <span className="text-on-surface-variant">{n}×</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-body-small text-on-surface-variant mt-2">
                &ldquo;Desistiu&rdquo; é escolha explícita; &ldquo;última tela vista&rdquo; é inferência das perdidas.
              </p>
            </section>
          )}

          {/* Heatmap geral (com opção de "first click" no seletor) */}
          <section>
            <h2 className="text-title-large text-on-surface mb-1">Heatmap por tela</h2>
            <p className="text-body-small text-on-surface-variant mb-4">
              Alterne entre todos os cliques, só cliques, o primeiro toque de cada participante
              (first click) e a imagem da tela.
            </p>
            {heatmapScreens.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum clique registrado nas telas.
              </p>
            ) : (
              <HeatmapViewer screens={heatmapScreens} deviceType={deviceType} />
            )}
          </section>

          {/* Caminhos */}
          <section>
            <h2 className="text-title-large text-on-surface mb-4">Caminhos percorridos</h2>
            <div className="space-y-2">
              {pathGroups.map((g, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <Badge variant={bucketColor[g.bucket]}>
                      {bucketLabel[g.bucket]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {g.count} {g.count === 1 ? "pessoa" : "pessoas"} · méd.{" "}
                      {formatDuration(g.totalDuration / g.count)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap text-xs">
                    {g.path.map((sid, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded bg-muted">
                          {screenById.get(sid)?.name ?? "?"}
                        </span>
                        {idx < g.path.length - 1 && (
                          <span className="text-muted-foreground">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sessões individuais */}
          <section>
            <h2 className="text-title-large text-on-surface mb-4">Sessões individuais</h2>
            <div className="space-y-2">
              {sessionRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-4 border rounded-lg p-3"
                >
                  <div className="flex -space-x-2 shrink-0">
                    {row.thumbs.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-10 h-10 rounded border-2 border-background object-cover bg-muted"
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(row.durationMs)} · {row.misclickCount} misclick(s)
                    </p>
                  </div>
                  <Badge variant={bucketColor[row.bucket]}>
                    {bucketLabel[row.bucket]}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
        </TabsContent>

        {mission.questions.length > 0 && (
          <TabsContent value="questions">
            <div className="space-y-4">
              {mission.questions.map((q, i) => (
                <QuestionResultCard key={q.id} studyId={id} index={i} question={q} hideMissionRef />
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  info,
}: {
  label: string
  value: string
  sub?: string
  info?: string
}) {
  return (
    <div className="relative border border-outline-variant rounded-2xl p-5 bg-surface-container-low">
      {info && (
        <div className="absolute top-2.5 right-2.5">
          <MetricInfo text={info} />
        </div>
      )}
      <p className="text-headline-small text-on-surface">{value}</p>
      <p className="text-body-small text-on-surface-variant mt-1">{label}</p>
      {sub && <p className="text-label-small text-on-surface-variant/70 mt-0.5">{sub}</p>}
    </div>
  )
}
