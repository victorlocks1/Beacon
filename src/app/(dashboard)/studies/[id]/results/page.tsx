import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Users } from "lucide-react"
import { formatDuration, formatPct } from "@/lib/format"

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
