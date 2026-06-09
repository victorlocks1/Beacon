import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { TestRunner } from "@/components/test/test-runner"

export default async function TestRunPage({
  params,
}: {
  params: Promise<{ studyId: string; token: string }>
}) {
  const { studyId, token } = await params

  const testSession = await prisma.session.findUnique({
    where: { token },
    include: {
      study: {
        include: {
          prototype: {
            include: {
              screens: {
                orderBy: { order: "asc" },
                include: { hotspots: true, scrollRegions: true },
              },
            },
          },
          blocks: {
            where: { type: "mission" },
            orderBy: { order: "asc" },
            include: {
              mission: {
                include: {
                  goals: true,
                  paths: { include: { steps: { orderBy: { order: "asc" } } } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!testSession || testSession.studyId !== studyId) notFound()

  // Sessão já finalizada → agradecimento
  if (testSession.finishedAt) {
    return <ThankYou />
  }

  const study = testSession.study
  const screens = study.prototype?.screens ?? []
  const missions = study.blocks
    .map((b) => b.mission)
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .map((m) => {
      // Telas que encerram a missão: alvos (screen) ou telas finais dos caminhos (path)
      const goalScreenIds =
        m.successType === "path"
          ? [
              ...new Set(
                m.paths
                  .map((p) => p.steps[p.steps.length - 1]?.screenId)
                  .filter((s): s is string => !!s)
              ),
            ]
          : m.goals.map((g) => g.goalScreenId)
      return {
        id: m.id,
        task: m.task,
        description: m.description,
        startScreenId: m.startScreenId,
        goalScreenIds,
      }
    })

  if (screens.length === 0 || missions.length === 0) {
    return <ThankYou />
  }

  return (
    <TestRunner
      token={token}
      deviceType={(study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
      screens={screens.map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.imageUrl,
        scroll: s.scroll,
        hotspots: s.hotspots.map((h) => ({
          id: h.id,
          coords: h.coords as { x: number; y: number; w: number; h: number },
          action: h.action,
          overlayPosition: h.overlayPosition,
          targetScreenId: h.targetScreenId,
        })),
        scrollRegions: s.scrollRegions.map((r) => ({
          id: r.id,
          coords: r.coords as { x: number; y: number; w: number; h: number },
          axis: r.axis as "horizontal" | "vertical" | "both",
          imageUrl: r.imageUrl,
        })),
      }))}
      missions={missions}
    />
  )
}

function ThankYou() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-12 text-center space-y-2">
        <h1 className="text-headline-small text-on-surface">Obrigado! 🎉</h1>
        <p className="text-body-medium text-on-surface-variant">
          Você concluiu o teste. Pode fechar esta aba.
        </p>
      </div>
    </div>
  )
}
