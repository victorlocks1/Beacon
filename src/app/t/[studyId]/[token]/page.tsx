import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { TestRunner } from "@/components/test/test-runner"
import { Card, CardContent } from "@/components/ui/card"

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
                include: { hotspots: true },
              },
            },
          },
          blocks: {
            where: { type: "mission" },
            orderBy: { order: "asc" },
            include: {
              mission: { include: { goals: true } },
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
    .map((m) => ({
      id: m.id,
      task: m.task,
      description: m.description,
      startScreenId: m.startScreenId,
      goalScreenIds: m.goals.map((g) => g.goalScreenId),
    }))

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
        order: s.order,
        imageUrl: s.imageUrl,
        width: s.width,
        height: s.height,
        hotspots: s.hotspots.map((h) => ({
          id: h.id,
          coords: h.coords as { x: number; y: number; w: number; h: number },
          targetScreenId: h.targetScreenId,
        })),
      }))}
      missions={missions}
    />
  )
}

function ThankYou() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center space-y-2">
          <h1 className="text-xl font-bold">Obrigado! 🎉</h1>
          <p className="text-sm text-muted-foreground">
            Você concluiu o teste. Pode fechar esta aba.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
