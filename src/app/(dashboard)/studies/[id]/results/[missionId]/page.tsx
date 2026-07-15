import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { formatDuration, formatPct } from "@/lib/format"
import { reconstructPath, classifyExactPath } from "@/lib/path"
import { median, lostness, lostnessBand } from "@/lib/metrics"
import { sumScore, sumAverage, sumVerdict, idealTimeMs as sumIdealMs, asqStatementsFor, ASQ_LABELS, ASQ_ANCHORS, type SumBreakdown } from "@/lib/sum"
import { HeatmapViewer } from "@/components/results/heatmap-viewer"
import { MetricInfo } from "@/components/results/metric-info"
import { QuestionResultCard } from "@/components/results/question-result-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FigmaImagesAutoLoad } from "@/components/results/load-figma-images-button"
import { ExportButton } from "@/components/results/export-button"
import { questionReportSection, type Report, type ReportSection } from "@/lib/report"

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
      paths: { include: { steps: { orderBy: { order: "asc" } } } },
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

  // SUM: respostas do ASQ (3 × 1..7) desta tarefa, por sessão.
  const sumResponses = await prisma.sumResponse.findMany({
    where: { missionId, session: { studyId: id } },
    select: { sessionId: true, values: true },
  })
  const asqBySession = new Map(sumResponses.map((r) => [r.sessionId, r.values]))

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

  // Caminho percorrido por sessão (a partir dos eventos de navegação).
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

  // Reclassifica o desfecho pela regra ATUAL, a partir do caminho gravado (SEM
  // alterar o banco — recálculo em tela). Só reavalia sucessos automáticos
  // (direct/indirect) de caminho exato; desistência (given_up), abandono e
  // missões de tela-alvo permanecem como estão.
  const isPath = mission.successType === "path"
  const expectedPaths = mission.paths.map((p) => p.steps.map((s) => s.screenId))
  type Oc = "direct" | "indirect" | "given_up" | "unfinished"
  const effOutcome = new Map<string, Oc>()
  for (const r of results) {
    let o: Oc = r.outcome
    if (isPath && (r.outcome === "direct" || r.outcome === "indirect")) {
      o = classifyExactPath(pathFor(r.sessionId), expectedPaths) ?? "unfinished"
    }
    effOutcome.set(r.sessionId, o)
  }
  const oc = (r: { sessionId: string }): Oc => effOutcome.get(r.sessionId) ?? "unfinished"

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
    const o = r ? oc(r) : null
    if (o === "direct") stateBySession.set(sid, "completed")
    else if (o === "indirect") stateBySession.set(sid, "indirect")
    else if (o === "given_up") stateBySession.set(sid, "declared")
    else if (sessionEnded.get(sid)) stateBySession.set(sid, "lost")
    else stateBySession.set(sid, "open")
  }
  const counts = { completed: 0, indirect: 0, declared: 0, lost: 0, open: 0 }
  for (const st of stateBySession.values()) counts[st]++
  // As taxas somam 100% sobre as sessões ENCERRADAS (concluída + indireta +
  // declarada + perdida).
  const ended = counts.completed + counts.indirect + counts.declared + counts.lost
  // SUCESSO = concluiu a tarefa = DIRETO + INDIRETO (ambos completaram o caminho
  // exato; direto = limpo, indireto = vagou antes). Só desistiu/perdida = falha.
  const successCount = counts.completed + counts.indirect
  const completionRate = ended ? (successCount / ended) * 100 : 0
  const directRate = ended ? (counts.completed / ended) * 100 : 0
  const indirectRate = ended ? (counts.indirect / ended) * 100 : 0
  const declaredRate = ended ? (counts.declared / ended) * 100 : 0
  const lostRate = ended ? (counts.lost / ended) * 100 : 0

  // ── Caminho exato: entre quem NÃO teve sucesso (desistiu/abandonou), separa
  //    quem ALCANÇOU a tela-objetivo por uma rota diferente do caminho definido
  //    ("chegou por fora") de quem NUNCA chegou nela ("se perdeu"). ──
  const goalScreenIds = new Set(
    expectedPaths.map((p) => p[p.length - 1]).filter((s): s is string => !!s)
  )
  let offPathReached = 0 // não-sucesso que alcançou a tela-objetivo por fora do caminho
  let neverReached = 0 // não-sucesso que nunca chegou na tela-objetivo
  if (isPath && goalScreenIds.size > 0) {
    for (const sid of startedSessionIds) {
      const st = stateBySession.get(sid)
      if (st !== "lost" && st !== "declared") continue // só os encerrados sem sucesso
      const reached = pathFor(sid).some((s) => goalScreenIds.has(s))
      if (reached) offPathReached++
      else neverReached++
    }
  }
  const notSuccessEnded = counts.declared + counts.lost
  const offPathRate = notSuccessEnded ? (offPathReached / notSuccessEnded) * 100 : 0

  // Esforço (sobre quem tem resultado registrado)
  const totalClicks = results.reduce((a, r) => a + r.clickCount, 0)
  const totalMisclicks = results.reduce((a, r) => a + r.misclickCount, 0)
  const misclickRate = totalClicks ? (totalMisclicks / totalClicks) * 100 : 0
  // Duração: MEDIANA (tempos são enviesados à direita), separando quem concluiu
  // (direto/indireto) de quem NÃO concluiu (desistiu; perdidas não têm duração).
  const completeDurations = results
    .filter((r) => oc(r) === "direct" || oc(r) === "indirect")
    .map((r) => r.durationMs)
  const failDurations = results.filter((r) => oc(r) === "given_up").map((r) => r.durationMs)
  const medComplete = median(completeDurations)
  const medFail = median(failDurations)

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

  // ── Tempo até o 1º toque: MEDIANA só de quem clicou; reporta quantos nunca clicaram ──
  const firstTaps = [...firstClickBySession.values()].map((fc) => fc.tMs)
  const clickers = firstTaps.length
  const neverClicked = startedSessionIds.size - clickers
  const medFirstTap = median(firstTaps)

  // ── Abandono: tela onde DESISTIU (escolha) e ÚLTIMA tela vista das perdidas (inferência) ──
  const giveUpByScreen = new Map<string, number>()
  for (const e of events) if (e.type === "give_up") giveUpByScreen.set(e.screenId, (giveUpByScreen.get(e.screenId) ?? 0) + 1)
  const lastScreenBySession = new Map<string, string>()
  for (const e of events) lastScreenBySession.set(e.sessionId, e.screenId) // eventos em ordem asc → última = mais recente
  const lostLastScreen = new Map<string, number>()
  // Engajamento no abandono: por tela de abandono, quantos CLICARAM ali antes de
  // sair (tentaram → travaram) × quantos NÃO tocaram em nada (desengajaram).
  const clickScreensBySession = new Map<string, Set<string>>()
  for (const e of events) {
    if (e.type !== "click" && e.type !== "misclick") continue
    const set = clickScreensBySession.get(e.sessionId) ?? new Set<string>()
    set.add(e.screenId)
    clickScreensBySession.set(e.sessionId, set)
  }
  const lostEngage = new Map<string, { total: number; clicked: number }>()
  for (const [sid, st] of stateBySession) {
    if (st !== "lost") continue
    const sc = lastScreenBySession.get(sid)
    if (!sc) continue
    lostLastScreen.set(sc, (lostLastScreen.get(sc) ?? 0) + 1)
    const cur = lostEngage.get(sc) ?? { total: 0, clicked: 0 }
    cur.total++
    if (clickScreensBySession.get(sid)?.has(sc)) cur.clicked++
    lostEngage.set(sc, cur)
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
  // Heatmap por tela: mostra TODAS as telas VISITADAS (não só as clicadas). A
  // tela inicial da tarefa entra sempre (mesmo sem evento). Telas sem clique
  // aparecem normalmente (só a imagem, sem overlay). Ordem = 1ª visita.
  const firstSeenAt = new Map<string, number>()
  firstSeenAt.set(mission.startScreenId, -1) // inicial sempre primeiro
  for (const e of events) {
    const t = Number(e.timestampMs)
    const prev = firstSeenAt.get(e.screenId)
    if (prev === undefined || t < prev) firstSeenAt.set(e.screenId, t)
  }
  const heatmapScreens = [...firstSeenAt.keys()]
    .map((sid) => screenById.get(sid))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .sort((a, b) => (firstSeenAt.get(a.id)! - firstSeenAt.get(b.id)!) || a.order - b.order)
    .map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      imageUrl: s.imageUrl,
      points: pointsByScreen.get(s.id) ?? [],
      firstClickPoints: firstClickByScreen.get(s.id) ?? [],
    }))

  // ── Lostness (só caminho exato): compara telas visitadas com o caminho ótimo.
  //    N = únicas visitadas, S = total (com revisitas), R = mínimo do caminho ótimo.
  const optimalLens = mission.paths
    .map((p) => new Set(p.steps.map((st) => st.screenId)).size)
    .filter((n) => n > 0)
  const R = optimalLens.length ? Math.min(...optimalLens) : 0
  const lostnessVals: number[] = []
  if (isPath && R > 0) {
    for (const r of results) {
      const path = pathFor(r.sessionId)
      const L = lostness(new Set(path).size, path.length, R)
      if (L != null) lostnessVals.push(L)
    }
  }
  const medLostness = median(lostnessVals)
  const lostBand = lostnessBand(medLostness)

  // ── SUM (Single Usability Metric) — só quando a coleta está ligada ──
  // Toques ideais ~ maior caminho exato (transições). Tempo ideal = override
  // da missão OU estimativa KLM. SUM por participante e média da tarefa.
  const idealTaps = mission.paths.length
    ? Math.max(...mission.paths.map((p) => Math.max(0, p.steps.length - 1)))
    : 0
  const missionIdealMs = sumIdealMs(mission.idealTimeMs, idealTaps)
  const sumRows = study.sumEnabled
    ? results.map((r) => {
        const asq = asqBySession.get(r.sessionId) ?? null
        const o = oc(r)
        return {
          tester: testerNumber.get(r.sessionId) ?? 0,
          outcome: o,
          durationMs: r.durationMs,
          asq,
          breakdown: sumScore({
            completed: o === "direct" || o === "indirect",
            indirect: o === "indirect",
            durationMs: r.durationMs,
            misclicks: r.misclickCount,
            satisfactionValues: asq,
            idealMs: missionIdealMs,
            idealTaps,
          }),
        }
      })
    : []
  // ALINHAMENTO (a): a dimensão CONCLUSÃO do SUM usa a MESMA régua do funil —
  // inclui os abandonos silenciosos (iniciaram + encerraram, sem resultado) como
  // conclusão 0. Eles não têm dado das outras dimensões (ficam null). Assim a
  // conclusão do SUM = concluíram ÷ todos que tentaram (não superestima).
  const sumSilentAbandons = study.sumEnabled
    ? [...startedSessionIds].filter((sid) => !resultBySession.has(sid) && sessionEnded.get(sid)).length
    : 0
  const sumAllBreakdowns: SumBreakdown[] = [
    ...sumRows.map((r) => r.breakdown),
    ...Array.from(
      { length: sumSilentAbandons },
      (): SumBreakdown => ({ completion: 0, time: null, errors: null, satisfaction: null, score: 0 })
    ),
  ]
  const sumAvg = sumAllBreakdowns.length ? sumAverage(sumAllBreakdowns) : null
  const sumV = sumAvg ? sumVerdict(sumAvg.score) : null
  const asqRespondents = sumResponses.length
  // Respostas de CADA pergunta do ASQ (média 1–7 + distribuição) para exibir.
  const sumLang = (study.language ?? "pt") === "es" ? "es" : "pt"
  const asqTexts = asqStatementsFor(sumLang, study.sumStatements)
  const asqStats = [0, 1, 2].map((i) => {
    const vals = sumResponses
      .map((r) => r.values[i])
      .filter((v): v is number => typeof v === "number" && v >= 1)
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const dist = [1, 2, 3, 4, 5, 6, 7].map((n) => vals.filter((v) => v === n).length)
    return { text: asqTexts[i], label: ASQ_LABELS[sumLang][i], avg, dist, count: vals.length }
  })

  // ── Agrupar caminhos por desfecho ──
  type PathGroup = {
    bucket: "direct" | "indirect" | "unfinished"
    path: string[]
    count: number
    totalDuration: number
  }
  // Sessões abandonadas (iniciaram, não concluíram nem desistiram, e encerraram):
  // não têm MissionResult, mas TÊM caminho (eventos de navegação). Entram na
  // análise para entender o que a pessoa tentou fazer. Excluímos quem TEM
  // MissionResult (já entra pelo loop de results — inclusive os reclassificados),
  // para não contar em dobro.
  const lostSessionIds = [...stateBySession.entries()]
    .filter(([sid, st]) => st === "lost" && !resultBySession.has(sid))
    .map(([sid]) => sid)
  // Duração aproximada (último evento) e misclicks das abandonadas, a partir dos eventos.
  const lastEventMsBySession = new Map<string, number>()
  const misclickBySession = new Map<string, number>()
  for (const e of events) {
    const t = Number(e.timestampMs)
    if (t > (lastEventMsBySession.get(e.sessionId) ?? -1)) lastEventMsBySession.set(e.sessionId, t)
    if (e.type === "misclick")
      misclickBySession.set(e.sessionId, (misclickBySession.get(e.sessionId) ?? 0) + 1)
  }

  const groupMap = new Map<string, PathGroup>()
  for (const r of results) {
    const bucket = outcomeBucket[oc(r)]
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
  // caminhos das abandonadas → bucket "não concluído"
  for (const sid of lostSessionIds) {
    const path = pathFor(sid)
    const key = `unfinished|${path.join(">")}`
    const g = groupMap.get(key)
    if (g) {
      g.count++
      g.totalDuration += lastEventMsBySession.get(sid) ?? 0
    } else {
      groupMap.set(key, {
        bucket: "unfinished",
        path,
        count: 1,
        totalDuration: lastEventMsBySession.get(sid) ?? 0,
      })
    }
  }
  const bucketOrder = { direct: 0, indirect: 1, unfinished: 2 }
  const pathGroups = [...groupMap.values()].sort(
    (a, b) => bucketOrder[a.bucket] - bucketOrder[b.bucket] || b.count - a.count
  )

  // ── Sessões individuais (inclui as abandonadas, com o caminho percorrido) ──
  const thumbsFor = (path: string[]) =>
    path
      .slice(0, 4)
      .map((sid) => screenById.get(sid)?.imageUrl)
      .filter((u): u is string => !!u)
  const sessionRows = [
    ...results.map((r) => ({
      id: r.sessionId,
      label: `Testador ${testerNumber.get(r.sessionId) ?? "?"}`,
      bucket: outcomeBucket[oc(r)],
      badgeText: oc(r) === "given_up" ? "Desistiu" : undefined,
      durationMs: r.durationMs,
      misclickCount: r.misclickCount,
      thumbs: thumbsFor(pathFor(r.sessionId)),
    })),
    ...lostSessionIds.map((sid) => ({
      id: sid,
      label: `Testador ${testerNumber.get(sid) ?? "?"}`,
      bucket: "unfinished" as const,
      badgeText: "Abandonou",
      durationMs: lastEventMsBySession.get(sid) ?? 0,
      misclickCount: misclickBySession.get(sid) ?? 0,
      thumbs: thumbsFor(pathFor(sid)),
    })),
  ]

  // ── Relatório exportável desta missão (Excel / PDF / Markdown) ──
  const nameOfPath = (path: string[]) =>
    path.map((sid) => screenById.get(sid)?.name ?? "?").join(" → ")
  const reportSections: ReportSection[] = [
    {
      heading: "Resumo",
      kind: "keyvalue",
      pairs: [
        ["Iniciaram", String(startedSessionIds.size)],
        ["Concluíram", `${successCount} (${formatPct(completionRate)})`],
        ["Direto", `${counts.completed} (${formatPct(directRate)})`],
        ["Indireto", `${counts.indirect} (${formatPct(indirectRate)})`],
        ["Desistiram", `${counts.declared} (${formatPct(declaredRate)})`],
        ["Abandonaram", `${counts.lost} (${formatPct(lostRate)})`],
        ...(isPath
          ? ([
              ["Chegou ao objetivo por fora do caminho", String(offPathReached)],
              ["Não chegou ao objetivo (se perdeu)", String(neverReached)],
            ] as [string, string][])
          : []),
        ["Em aberto", String(counts.open)],
        ["Duração mediana (concluíram)", completeDurations.length ? formatDuration(medComplete) : "—"],
        ["Duração mediana (não concluíram)", failDurations.length ? formatDuration(medFail) : "—"],
        ["Misclick rate", formatPct(misclickRate)],
        ["Nunca clicaram", String(neverClicked)],
        ["Lostness (mediana)", lostnessVals.length ? `${medLostness.toFixed(2)} (${lostBand.label})` : "—"],
      ],
    },
  ]
  if (sumAvg && sumV) {
    reportSections.push({
      heading: "SUM da tarefa",
      kind: "keyvalue",
      pairs: [
        ["Nota SUM", `${formatPct(sumAvg.score)} (${sumV.label})`],
        ["Conclusão", formatPct(sumAvg.completion)],
        ["Tempo", sumAvg.time == null ? "—" : formatPct(sumAvg.time)],
        ["Erros", sumAvg.errors == null ? "—" : formatPct(sumAvg.errors)],
        ["Satisfação (ASQ)", sumAvg.satisfaction == null ? "—" : formatPct(sumAvg.satisfaction)],
      ],
    })
    for (const q of asqStats) {
      reportSections.push({
        heading: `ASQ · ${q.label}: ${q.text}`,
        kind: "table",
        columns: ["Nota (1–7)", "Respostas"],
        rows: [
          ...q.dist.map((c, i) => [String(i + 1), c] as (string | number)[]),
          ["Média", q.avg == null ? "—" : q.avg.toFixed(1)],
          ["Total", q.count],
        ],
      })
    }
    reportSections.push({
      heading: "SUM por participante",
      kind: "table",
      columns: ["Participante", "Conclusão", "Tempo", "Erros", "Satisfação", "SUM"],
      rows: sumRows
        .slice()
        .sort((a, b) => a.tester - b.tester)
        .map((r) => {
          const c = (v: number | null) => (v == null ? "—" : formatPct(v))
          return [
            `Testador ${r.tester}`,
            c(r.breakdown.completion),
            c(r.breakdown.time),
            c(r.breakdown.errors),
            c(r.breakdown.satisfaction),
            formatPct(r.breakdown.score),
          ]
        }),
    })
  }
  for (const q of mission.questions) {
    reportSections.push(
      questionReportSection({
        type: q.type,
        title: q.title,
        options: q.options,
        answers: q.answers,
      })
    )
  }
  if (pathGroups.length > 0) {
    reportSections.push({
      heading: "Caminhos percorridos",
      kind: "table",
      columns: ["Desfecho", "Caminho", "Pessoas", "Duração média"],
      rows: pathGroups.map((g) => [
        bucketLabel[g.bucket],
        nameOfPath(g.path),
        g.count,
        g.count ? formatDuration(Math.round(g.totalDuration / g.count)) : "—",
      ]),
    })
  }
  if (giveUpRows.length > 0 || lostRows.length > 0) {
    reportSections.push({
      heading: "Onde as pessoas abandonam",
      kind: "table",
      columns: ["Situação", "Tela", "Pessoas", "Clicaram antes de sair", "Não tocaram em nada"],
      rows: [
        ...giveUpRows.map(([sid, n]) => ["Desistiu (declarado)", nameOf(sid), n, "—", "—"] as (string | number)[]),
        ...lostRows.map(([sid, n]) => {
          const clicked = lostEngage.get(sid)?.clicked ?? 0
          return ["Última tela vista (perdida)", nameOf(sid), n, clicked, n - clicked] as (string | number)[]
        }),
      ],
    })
  }
  reportSections.push({
    heading: "Sessões individuais",
    kind: "table",
    columns: ["Participante", "Desfecho", "Duração", "Misclicks"],
    rows: sessionRows.map((r) => [
      r.label,
      r.badgeText ?? bucketLabel[r.bucket],
      formatDuration(r.durationMs),
      r.misclickCount,
    ]),
  })
  const missionReport: Report = {
    title: `Missão: ${mission.task}`,
    subtitle: study.title,
    sections: reportSections,
  }
  const reportFilename = `beacon-missao-${mission.task.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "tarefa"}`

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
        {startedSessionIds.size > 0 && (
          <ExportButton report={missionReport} filename={reportFilename} />
        )}
      </div>

      <Tabs defaultValue="geral">
        {(mission.questions.length > 0 || sumAvg) && (
          <TabsList className="mb-6">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            {sumAvg && <TabsTrigger value="sum">SUM</TabsTrigger>}
            {mission.questions.length > 0 && (
              <TabsTrigger value="questions">
                Perguntas realizadas ({mission.questions.length})
              </TabsTrigger>
            )}
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
          {/* ── Destaques: taxa de sucesso + tempo na tarefa (as 2 principais) ── */}
          <div>
            {/* Funil absoluto DESTA tarefa (independe de terminar o teste inteiro) */}
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-medium">
              <span className="text-on-surface font-medium">{startedSessionIds.size}</span>
              <span className="text-on-surface-variant">iniciaram esta tarefa</span>
              <span className="text-on-surface-variant/50">·</span>
              <span className="text-on-surface font-medium">{successCount}</span>
              <span className="text-on-surface-variant">concluíram</span>
              {counts.declared > 0 && (
                <>
                  <span className="text-on-surface-variant/50">·</span>
                  <span className="text-on-surface font-medium">{counts.declared}</span>
                  <span className="text-on-surface-variant">desistiram</span>
                </>
              )}
              {counts.lost > 0 && (
                <>
                  <span className="text-on-surface-variant/50">·</span>
                  <span className="text-on-surface font-medium">{counts.lost}</span>
                  <span className="text-on-surface-variant">abandonaram</span>
                </>
              )}
              {counts.open > 0 && (
                <>
                  <span className="text-on-surface-variant/50">·</span>
                  <span className="text-on-surface font-medium">{counts.open}</span>
                  <span className="text-on-surface-variant">em aberto</span>
                </>
              )}
            </div>
            {/* Caminho exato: entre os não-sucesso, quem chegou ao objetivo por fora */}
            {isPath && notSuccessEnded > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-small text-on-surface-variant">
                <span>Dos que não tiveram sucesso:</span>
                <span className="text-on-surface font-medium">{offPathReached}</span>
                <span>chegaram ao objetivo por outro caminho</span>
                <span className="text-on-surface-variant/50">·</span>
                <span className="text-on-surface font-medium">{neverReached}</span>
                <span>se perderam (não chegaram)</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Kpi
                big
                label="Conclusão"
                value={formatPct(completionRate)}
                sub={`${successCount} de ${ended} concluíram`}
                info={
                  isPath
                    ? "Sucesso = concluiu a tarefa percorrendo o caminho exato — DIRETO (limpo) ou INDIRETO (vagou e depois completou). Ambos contam como conclusão. Chegar na tela final SEM percorrer o caminho exato não conta. Denominador = sessões encerradas."
                    : "Participantes que chegaram na tela-objetivo da tarefa. Denominador = sessões encerradas (concluídas + desistências + perdidas)."
                }
              />
              <Kpi
                big
                label="Duração na tarefa"
                value={completeDurations.length ? formatDuration(medComplete) : "—"}
                sub={completeDurations.length ? `mediana de ${completeDurations.length} · concluíram` : "sem conclusões"}
                info="Tempo MEDIANO da tarefa entre quem concluiu. Mediana porque tempos têm outliers — mais fiel que a média (padrão NN/G)."
              />
            </div>
            {counts.open > 0 && (
              <p className="text-body-small text-on-surface-variant mt-2">
                {counts.open} sessão(ões) ainda em aberto (não encerradas) — fora do cálculo.
              </p>
            )}
          </div>

          {/* ── Métricas de apoio (cards menores) ── */}
          <div>
            <p className="text-label-medium text-on-surface-variant mb-3">MÉTRICAS DE APOIO</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {isPath && (
                <Kpi
                  label="Direto"
                  value={formatPct(directRate)}
                  sub={`${counts.completed} de ${ended}`}
                  info="Concluiu seguindo o caminho exato LIMPO, sem desvios. É parte da Conclusão."
                />
              )}
              {isPath && (
                <Kpi
                  label="Indireto"
                  value={formatPct(indirectRate)}
                  sub={`${counts.indirect} de ${ended}`}
                  info="Concluiu o caminho exato, mas VAGOU por outras telas antes. Também é sucesso (entra na Conclusão), só não foi direto."
                />
              )}
              <Kpi
                label="Desistência declarada"
                value={formatPct(declaredRate)}
                sub={`${counts.declared} de ${ended}`}
                info="Participantes que clicaram em 'Não consegui' — declararam que não conseguiram concluir."
              />
              <Kpi
                label="Perdida"
                value={formatPct(lostRate)}
                sub={`${counts.lost} de ${ended}`}
                info="Abandono silencioso: iniciou mas não concluiu nem desistiu, e a sessão encerrou (fim do teste ou inatividade > 30 min)."
              />
              {isPath && notSuccessEnded > 0 && (
                <Kpi
                  label="Chegou por fora"
                  value={String(offPathReached)}
                  sub={`de ${notSuccessEnded} sem sucesso`}
                  info="Caminho exato: entre quem NÃO teve sucesso, quantos ALCANÇARAM a tela-objetivo por uma rota diferente do caminho definido. Sinal de que o objetivo é alcançável, mas por outro caminho. Os demais não-sucesso nunca chegaram na tela-objetivo (se perderam)."
                />
              )}
              <Kpi
                label="Duração — não concl."
                value={failDurations.length ? formatDuration(medFail) : "—"}
                sub={failDurations.length ? "mediana · desistiram" : "sem desistências"}
                info="Tempo mediano de quem DESISTIU. As 'perdidas' não têm duração registrada."
              />
              <Kpi
                label="Tempo até 1º toque"
                value={clickers ? formatDuration(medFirstTap) : "—"}
                sub={clickers ? `mediana de ${clickers}` : "sem cliques"}
                info="Tempo (mediana) do início até o primeiro clique. Só de quem clicou. Um 1º toque no caminho certo prevê ~2x mais sucesso (Bailey & Wolfson)."
              />
              <Kpi
                label="Misclick rate"
                value={formatPct(misclickRate)}
                info="Percentual de cliques fora de uma área clicável (erro de alvo), sobre o total de cliques."
              />
              <Kpi
                label="Nunca clicaram"
                value={String(neverClicked)}
                sub="não têm 1º toque"
                info="Quantos participantes iniciaram e não deram nenhum clique."
              />
              {isPath && lostnessVals.length > 0 && (
                <Kpi
                  label="Lostness"
                  value={medLostness.toFixed(2)}
                  sub={lostBand.label}
                  info="Métrica de 'perdido' (Smith, 1996 / NN/G): 0 = caminho perfeito; < 0,4 não-perdido; > 0,5 perdido. Compara telas visitadas (únicas e totais) com o caminho ótimo. Obs.: se o caminho ótimo revisita uma tela, o valor perfeito já fica > 0."
                />
              )}
            </div>
          </div>

          {/* Tela do abandono */}
          {(giveUpRows.length > 0 || lostRows.length > 0) && (
            <section>
              <h2 className="text-title-large text-on-surface mb-4 flex items-center gap-1.5">
                Onde as pessoas abandonam
                <MetricInfo text="“Desistiu” é escolha explícita (clicou em Não consegui). “Última tela vista” é uma inferência das sessões perdidas — a última tela registrada antes de a sessão encerrar." />
              </h2>
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
                    <div className="space-y-2">
                      {lostRows.map(([sid, n]) => {
                        const eng = lostEngage.get(sid)
                        const clicked = eng?.clicked ?? 0
                        const noClick = n - clicked
                        return (
                          <div key={sid}>
                            <div className="flex items-center justify-between text-body-medium">
                              <span className="text-on-surface truncate">{nameOf(sid)}</span>
                              <span className="text-on-surface-variant">{n}×</span>
                            </div>
                            <p className="text-label-small text-on-surface-variant/80">
                              {clicked} clicaram antes de sair · {noClick} não tocaram em nada
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {lostRows.length > 0 && (
                    <p className="text-label-small text-on-surface-variant/70 mt-2">
                      Clicaram = tentaram e travaram (descoberta/próximo passo) · Não tocaram = desengajaram (fricção do teste).
                    </p>
                  )}
                </div>
              </div>
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
                Nenhuma tela visitada ainda.
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
                    {row.badgeText ?? bucketLabel[row.bucket]}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
        </TabsContent>

        {sumAvg && sumV && (
          <TabsContent value="sum">
            <div className="space-y-8">
              {/* Nota SUM + as 4 dimensões */}
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.1fr)_2fr] gap-4">
                <Kpi
                  big
                  label="SUM da tarefa"
                  value={formatPct(sumAvg.score)}
                  sub={sumV.label}
                  info="Single Usability Metric — média de até 4 dimensões (Conclusão, Tempo, Erros, Satisfação), 0–100%. Faixas: ≥95 Excelente · 80–94 Satisfatória · 65–79 Regular/atenção · 50–64 Insatisfatória · <50 Crítica."
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi label="Conclusão" value={formatPct(sumAvg.completion)} sub="de todos que tentaram"
                    info="Proporção que concluiu a tarefa (direto ou indireto) sobre TODOS que iniciaram/encerraram a tarefa — mesma régua do funil. O abandono silencioso conta como conclusão 0 (não superestima)." />
                  <Kpi label="Tempo"
                    value={sumAvg.time == null ? "—" : formatPct(sumAvg.time)}
                    sub={sumAvg.time == null ? "sem tempo ideal" : `ideal ${Math.round(missionIdealMs / 1000)}s`}
                    info="Eficiência = tempo ideal / tempo real. Tempo ideal via KLM (caminho exato) ou override da missão." />
                  <Kpi label="Erros"
                    value={sumAvg.errors == null ? "—" : formatPct(sumAvg.errors)}
                    sub={sumAvg.errors == null ? "sem caminho" : "misclicks + desvios"}
                    info="1 − erros/oportunidades. Erros = misclicks + desvio; oportunidades ~ toques do caminho ideal." />
                  <Kpi label="Satisfação"
                    value={sumAvg.satisfaction == null ? "—" : formatPct(sumAvg.satisfaction)}
                    sub={`ASQ · ${asqRespondents} resp.`}
                    info="Média das 3 perguntas do ASQ (1–7) normalizada para 0–100%." />
                </div>
              </div>

              {/* Respostas de cada pergunta (ASQ) */}
              {asqRespondents > 0 && (
                <div>
                  <p className="text-label-medium text-on-surface-variant mb-3">
                    PERGUNTAS (ASQ · escala 1–7)
                  </p>
                  <div className="space-y-3">
                    {asqStats.map((q, i) => {
                      const max = Math.max(1, ...q.dist)
                      return (
                        <div key={i} className="rounded-2xl border border-outline-variant p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-label-small text-on-surface-variant">{q.label}</p>
                              <p className="text-body-medium text-on-surface">{q.text}</p>
                            </div>
                            <span className="shrink-0 text-title-medium text-on-surface">
                              {q.avg == null ? "—" : q.avg.toFixed(1)}
                              <span className="text-body-small text-on-surface-variant">/7</span>
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-7 gap-1.5">
                            {q.dist.map((c, n) => (
                              <div key={n} className="flex flex-col items-center gap-1">
                                <div className="w-full h-16 flex items-end rounded bg-surface-container-high overflow-hidden">
                                  <div
                                    className="w-full rounded-t bg-primary/70"
                                    style={{ height: `${(c / max) * 100}%` }}
                                  />
                                </div>
                                <span className="text-label-small text-on-surface-variant">{n + 1}</span>
                                <span className="text-label-small text-on-surface-variant/70">{c}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-label-small text-on-surface-variant mt-2">
                            {q.count} resposta(s) · 1 = {ASQ_ANCHORS[sumLang].low} · 7 = {ASQ_ANCHORS[sumLang].high}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tabela por participante */}
              {sumRows.length > 0 && (
                <div>
                  <p className="text-label-medium text-on-surface-variant mb-3">POR PARTICIPANTE</p>
                  <div className="overflow-x-auto rounded-2xl border border-outline-variant">
                    <table className="w-full text-body-small">
                      <thead>
                        <tr className="border-b border-outline-variant text-on-surface-variant">
                          <th className="text-left font-medium px-4 py-2.5">Participante</th>
                          <th className="text-right font-medium px-3 py-2.5">Conclusão</th>
                          <th className="text-right font-medium px-3 py-2.5">Tempo</th>
                          <th className="text-right font-medium px-3 py-2.5">Erros</th>
                          <th className="text-right font-medium px-3 py-2.5">Satisf.</th>
                          <th className="text-right font-medium px-4 py-2.5">SUM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sumRows
                          .slice()
                          .sort((a, b) => a.tester - b.tester)
                          .map((r) => {
                            const b = r.breakdown
                            const cell = (v: number | null) => (v == null ? "—" : formatPct(v))
                            return (
                              <tr key={r.tester} className="border-b border-outline-variant last:border-0">
                                <td className="px-4 py-2.5 text-on-surface">Testador {r.tester}</td>
                                <td className="px-3 py-2.5 text-right text-on-surface-variant">{cell(b.completion)}</td>
                                <td className="px-3 py-2.5 text-right text-on-surface-variant">{cell(b.time)}</td>
                                <td className="px-3 py-2.5 text-right text-on-surface-variant">{cell(b.errors)}</td>
                                <td className="px-3 py-2.5 text-right text-on-surface-variant">{cell(b.satisfaction)}</td>
                                <td className="px-4 py-2.5 text-right text-on-surface font-medium">{formatPct(b.score)}</td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        )}

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
  big = false,
}: {
  label: string
  value: string
  sub?: string
  info?: string
  big?: boolean
}) {
  return (
    <div
      className={
        "relative border border-outline-variant rounded-2xl bg-surface-container-low " +
        (big ? "p-6" : "p-4")
      }
    >
      {info && (
        <div className="absolute top-2.5 right-2.5">
          <MetricInfo text={info} />
        </div>
      )}
      <p className={(big ? "text-display-small" : "text-headline-small") + " text-on-surface"}>{value}</p>
      <p className={(big ? "text-title-small" : "text-body-small") + " text-on-surface-variant mt-1"}>{label}</p>
      {sub && <p className="text-label-small text-on-surface-variant/70 mt-0.5">{sub}</p>}
    </div>
  )
}
