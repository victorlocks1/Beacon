import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { TestRunner } from "@/components/test/test-runner"
import { tt, type Lang } from "@/lib/i18n"

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
            orderBy: { order: "asc" },
            include: {
              mission: {
                include: {
                  goals: true,
                  paths: { include: { steps: { orderBy: { order: "asc" } } } },
                },
              },
              question: true,
            },
          },
        },
      },
    },
  })

  if (!testSession || testSession.studyId !== studyId) notFound()

  const lang = (testSession.study.language ?? "pt") as Lang

  // Sessão já finalizada → agradecimento
  if (testSession.finishedAt) {
    return <ThankYou lang={lang} />
  }

  const study = testSession.study
  const screens = study.prototype?.screens ?? []

  // Sequência de passos na ordem definida pelo criador (missões + perguntas)
  const testSteps = study.blocks
    .map((b) => {
      if (b.type === "mission" && b.mission) {
        const m = b.mission
        const goalScreenIds =
          m.successType === "path"
            ? [
                ...new Set(
                  m.paths
                    .map((p) => p.steps[p.steps.length - 1]?.screenId)
                    .filter((sid): sid is string => !!sid)
                ),
              ]
            : m.goals.map((g) => g.goalScreenId)
        return {
          kind: "mission" as const,
          mission: {
            id: m.id,
            task: m.task,
            description: m.description,
            startScreenId: m.startScreenId,
            goalScreenIds,
          },
        }
      }
      if (b.type === "question" && b.question) {
        const q = b.question
        return {
          kind: "question" as const,
          question: {
            id: q.id,
            type: q.type as "open" | "choice" | "rating" | "binary",
            title: q.title,
            description: q.description,
            required: q.required,
            options: (q.options as string[] | null) ?? [],
          },
        }
      }
      return null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const hasMission = testSteps.some((st) => st.kind === "mission")
  if (testSteps.length === 0 || (hasMission && screens.length === 0)) {
    return <ThankYou lang={lang} />
  }

  return (
    <TestRunner
      token={token}
      lang={lang}
      deviceType={(study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
      screens={screens.map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.imageUrl,
        width: s.width,
        height: s.height,
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
          kind: r.kind as "scroll" | "fixed",
          coords: r.coords as { x: number; y: number; w: number; h: number },
          axis: r.axis as "horizontal" | "vertical" | "both",
          imageUrl: r.imageUrl,
        })),
      }))}
      steps={testSteps}
    />
  )
}

function ThankYou({ lang }: { lang: Lang }) {
  const s = tt(lang)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-12 text-center space-y-2">
        <h1 className="text-headline-small text-on-surface">{s.thanksTitle}</h1>
        <p className="text-body-medium text-on-surface-variant">{s.thanksBody}</p>
      </div>
    </div>
  )
}
