import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { TestRunner } from "@/components/test/test-runner"
import { FigmaFlowRunner } from "@/components/test/figma-flow-runner"
import { FIGMA_EMBED_CLIENT_ID } from "@/lib/figma-embed"
import { tt, type Lang } from "@/lib/i18n"
import { susStatementsFor } from "@/lib/sus"
import { asqStatementsFor, ASQ_ANCHORS } from "@/lib/sum"
import { buildExactPaths, type PathStepDef } from "@/lib/path"

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
                  questions: { orderBy: { order: "asc" } },
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
    return (
      <ThankYou
        lang={lang}
        title={testSession.study.thanksTitle}
        message={testSession.study.thanksMessage}
      />
    )
  }

  const study = testSession.study
  const screens = study.prototype?.screens ?? []
  const proto = study.prototype

  type Step =
    | {
        kind: "mission"
        mission: {
          id: string
          task: string
          description: string | null
          startScreenId: string
          goalScreenIds: string[]
          successType: "screen" | "path"
          paths: PathStepDef[][] // passos do caminho exato (c/ opcional/wildcard)
        }
      }
    | {
        kind: "question"
        question: {
          id: string
          type: "open" | "choice" | "rating" | "binary"
          title: string
          description: string | null
          required: boolean
          options: string[]
        }
      }
    | { kind: "sus" }

  const toQuestionStep = (q: {
    id: string
    type: string
    title: string
    description: string | null
    required: boolean
    options: unknown
  }): Step => ({
    kind: "question",
    question: {
      id: q.id,
      type: q.type as "open" | "choice" | "rating" | "binary",
      title: q.title,
      description: q.description,
      required: q.required,
      options: (q.options as string[] | null) ?? [],
    },
  })

  // Sequência de passos na ordem definida pelo criador. Cada missão é seguida
  // pelas suas perguntas de acompanhamento; perguntas gerais entram soltas.
  const testSteps: Step[] = study.blocks.flatMap((b): Step[] => {
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
      return [
        {
          kind: "mission",
          mission: {
            id: m.id,
            task: m.task,
            description: m.description,
            startScreenId: m.startScreenId,
            goalScreenIds,
            successType: m.successType as "screen" | "path",
            paths: buildExactPaths(m.paths, screens),
          },
        },
        ...m.questions.map(toQuestionStep),
      ]
    }
    if (b.type === "question" && b.question) {
      return [toQuestionStep(b.question)]
    }
    if (b.type === "sus") {
      return [{ kind: "sus" }]
    }
    return []
  })

  const hasMission = testSteps.some((st) => st.kind === "mission")
  if (testSteps.length === 0 || (hasMission && screens.length === 0)) {
    return <ThankYou lang={lang} title={study.thanksTitle} message={study.thanksMessage} />
  }

  // ─── Protótipo VIVO do Figma (embed) é o padrão para estudos do Figma ───
  const canEmbed = proto?.source === "figma" && !!proto.figmaFileKey && !!FIGMA_EMBED_CLIENT_ID
  if (canEmbed) {
    // mapeia figmaNodeId → tela (id + tamanho) e monta os objetivos por missão
    const screenByNode: Record<string, { id: string; w: number; h: number }> = {}
    const screenToNode: Record<string, string> = {}
    for (const sc of screens) {
      if (sc.figmaNodeId) {
        screenByNode[sc.figmaNodeId] = { id: sc.id, w: sc.width, h: sc.height }
        screenToNode[sc.id] = sc.figmaNodeId
      }
    }
    const goalsByMission: Record<string, string[]> = {}
    const startNodeByMission: Record<string, string | null> = {}
    const successTypeByMission: Record<string, "screen" | "path"> = {}
    // Caminhos esperados (passos c/ opcional/wildcard) — rastreador do caminho exato
    const expectedPathsByMission: Record<string, PathStepDef[][]> = {}
    for (const st of testSteps) {
      if (st.kind === "mission") {
        goalsByMission[st.mission.id] = st.mission.goalScreenIds
          .map((gid) => screenToNode[gid])
          .filter((n): n is string => !!n)
        // frame de partida da missão (node-id do Figma), p/ o embed abrir ali
        startNodeByMission[st.mission.id] = screenToNode[st.mission.startScreenId] ?? null
        successTypeByMission[st.mission.id] = st.mission.successType
        expectedPathsByMission[st.mission.id] = st.mission.paths.filter((p) => p.length >= 2)
      }
    }
    return (
      <FigmaFlowRunner
        token={token}
        lang={lang}
        fileKey={proto!.figmaFileKey!}
        steps={testSteps}
        /* A tela de entrada (/t/<studyId>) já é a boas-vindas — não duplicar aqui */
        welcome={null}
        howItWorks={null} /* Como funciona agora fica na tela de boas-vindas (entry) */
        thanksTitle={study.thanksTitle}
        thanksMessage={study.thanksMessage}
        susStatements={susStatementsFor(lang === "es" ? "es" : "pt", study.susStatements)}
        sumEnabled={study.sumEnabled}
        sumStatements={asqStatementsFor(lang === "es" ? "es" : "pt", study.sumStatements)}
        sumAnchors={ASQ_ANCHORS[lang === "es" ? "es" : "pt"]}
        goalsByMission={goalsByMission}
        startNodeByMission={startNodeByMission}
        successTypeByMission={successTypeByMission}
        expectedPathsByMission={expectedPathsByMission}
        screenByNode={screenByNode}
      />
    )
  }

  return (
    <TestRunner
      token={token}
      lang={lang}
      deviceType={(study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
      howItWorks={null} /* Como funciona agora fica na tela de boas-vindas (entry) */
      thanksTitle={study.thanksTitle}
      thanksMessage={study.thanksMessage}
      susStatements={susStatementsFor(lang === "es" ? "es" : "pt", study.susStatements)}
      sumEnabled={study.sumEnabled}
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
          contentBox: r.contentBox as { x: number; y: number; w: number; h: number } | null,
          pieces: r.pieces as { url: string; x: number; y: number; w: number; h: number }[] | null,
        })),
      }))}
      steps={testSteps}
    />
  )
}

function ThankYou({
  lang,
  title,
  message,
}: {
  lang: Lang
  title?: string | null
  message?: string | null
}) {
  const s = tt(lang)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant p-12 text-center space-y-2">
        <h1 className="text-headline-small text-on-surface whitespace-pre-wrap">
          {title?.trim() || s.thanksTitle}
        </h1>
        <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">
          {message?.trim() || s.thanksBody}
        </p>
      </div>
    </div>
  )
}
