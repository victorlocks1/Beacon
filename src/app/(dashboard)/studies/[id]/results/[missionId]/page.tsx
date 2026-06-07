import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { formatDuration, formatPct } from "@/lib/format"
import { HeatmapViewer } from "@/components/results/heatmap-viewer"

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
  if (!session) redirect("/login")

  const mission = await prisma.mission.findFirst({
    where: { id: missionId, block: { study: { id, ownerId: session.user.id } } },
    include: {
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

  const results = await prisma.missionResult.findMany({
    where: { missionId, session: { studyId: id } },
    include: { session: true },
    orderBy: { session: { startedAt: "asc" } },
  })

  const events = await prisma.event.findMany({
    where: { missionId, session: { studyId: id } },
    orderBy: { timestampMs: "asc" },
  })

  // ── KPIs ──
  const total = results.length
  const successes = results.filter(
    (r) => r.outcome === "direct" || r.outcome === "indirect"
  ).length
  const totalClicks = results.reduce((a, r) => a + r.clickCount, 0)
  const totalMisclicks = results.reduce((a, r) => a + r.misclickCount, 0)
  const successRate = total ? (successes / total) * 100 : 0
  const misclickRate = totalClicks ? (totalMisclicks / totalClicks) * 100 : 0
  const avgDuration = total
    ? results.reduce((a, r) => a + r.durationMs, 0) / total
    : 0

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
    }))

  // ── Caminho por sessão ──
  const startScreenId = mission.startScreenId
  const eventsBySession = new Map<string, typeof events>()
  for (const e of events) {
    const arr = eventsBySession.get(e.sessionId) ?? []
    arr.push(e)
    eventsBySession.set(e.sessionId, arr)
  }

  function pathFor(sessionId: string): string[] {
    const evs = eventsBySession.get(sessionId) ?? []
    const navs = evs.filter((e) => e.type === "navigate" && e.targetScreenId)
    const ids: string[] = []
    for (const n of navs) {
      const tid = n.targetScreenId!
      if (ids[ids.length - 1] !== tid) ids.push(tid)
    }
    if (ids.length === 0) ids.push(startScreenId)
    return ids
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
      shortToken: r.session.token.slice(0, 8),
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/studies/${id}/results`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Resultados da missão</p>
          <h1 className="text-xl font-bold truncate">{mission.task}</h1>
        </div>
      </div>

      {total === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <p className="text-base font-medium">Ainda sem respostas</p>
          <p className="text-sm mt-1">
            Compartilhe o link do teste para começar a coletar dados.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Respostas" value={String(total)} />
            <Kpi label="Taxa de sucesso" value={formatPct(successRate)} />
            <Kpi label="Misclick rate" value={formatPct(misclickRate)} />
            <Kpi label="Duração média" value={formatDuration(avgDuration)} />
          </div>

          {/* Heatmap */}
          <section>
            <h2 className="font-semibold mb-3">Heatmap por tela</h2>
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
            <h2 className="font-semibold mb-3">Caminhos percorridos</h2>
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
            <h2 className="font-semibold mb-3">Sessões individuais</h2>
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
                    <p className="text-sm font-medium font-mono">
                      {row.shortToken}
                    </p>
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
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
