import { TestRunner } from "@/components/test/test-runner"
import { FigmaFlowRunner } from "@/components/test/figma-flow-runner"
import { runsLiveFigma } from "@/lib/figma-access"
import { tt, type Lang } from "@/lib/i18n"
import { susStatementsFor } from "@/lib/sus"
import { asqStatementsFor, ASQ_ANCHORS } from "@/lib/sum"
import { buildExactPaths, type PathStepDef } from "@/lib/path"
import { buildFigmaRunnerMaps } from "@/lib/figma-runner"
import { type Prisma } from "@/generated/prisma/client"

// O fluxo do participante (tarefas, perguntas, SUS, agradecimento) num lugar só.
// O link do testador e a REVISÃO usam exatamente este componente — a revisão só
// liga `preview` (não grava nada). Assim quem cria o teste vê a mesma página
// que o participante, e qualquer mudança vale para os dois ao mesmo tempo.

// Dados do estudo que o fluxo precisa (mesma consulta nas duas páginas).
export const testerStudyInclude = {
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
          goalHotspots: true,
          paths: { include: { steps: { orderBy: { order: "asc" } } } },
          questions: { orderBy: { order: "asc" } },
        },
      },
      question: true,
    },
  },
} satisfies Prisma.StudyInclude

export type TesterStudy = Prisma.StudyGetPayload<{ include: typeof testerStudyInclude }>

export async function TesterRun({
  study,
  token,
  preview = false,
}: {
  study: TesterStudy
  token: string
  preview?: boolean
}) {
  const lang = (study.language ?? "pt") as Lang
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
          goalHotspotIds: string[]
          successType: "screen" | "path" | "hotspot"
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
          screen?: { name: string; imageUrl: string } | null
        }
      }
    | { kind: "sus" }

  // tela exibida junto com a pergunta (quando o criador escolheu uma)
  const questionScreen = (screenId: string | null) => {
    const sc = screenId ? screens.find((x) => x.id === screenId) : null
    return sc ? { name: sc.name, imageUrl: sc.imageUrl } : null
  }

  const toQuestionStep = (q: {
    id: string
    type: string
    title: string
    description: string | null
    required: boolean
    options: unknown
    screenId: string | null
  }): Step => ({
    kind: "question",
    question: {
      id: q.id,
      type: q.type as "open" | "choice" | "rating" | "binary",
      title: q.title,
      description: q.description,
      required: q.required,
      options: (q.options as string[] | null) ?? [],
      screen: questionScreen(q.screenId),
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
            goalHotspotIds: m.goalHotspots.map((g) => g.hotspotId),
            successType: m.successType,
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
    return <TesterThankYou lang={lang} title={study.thanksTitle} message={study.thanksMessage} />
  }

  // ─── Protótipo VIVO do Figma (embed) é o padrão para estudos do Figma ───
  // Arquivo público → embed vivo. Arquivo restrito (login/senha) → RÉPLICA: o
  // mesmo teste roda nas imagens das telas + hotspots, sem depender do Figma.
  const canEmbed = await runsLiveFigma(proto)
  if (canEmbed) {
    const maps = buildFigmaRunnerMaps(
      screens,
      testSteps.flatMap((st) => (st.kind === "mission" ? [st.mission] : []))
    )
    return (
      <FigmaFlowRunner
        token={token}
        preview={preview}
        lang={lang}
        fileKey={proto!.figmaFileKey!}
        steps={testSteps}
        deviceType={(study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
        /* A tela de entrada (/t/<studyId>) já é a boas-vindas — não duplicar aqui */
        welcome={null}
        howItWorks={null} /* Como funciona agora fica na tela de boas-vindas (entry) */
        thanksTitle={study.thanksTitle}
        thanksMessage={study.thanksMessage}
        susStatements={susStatementsFor(lang === "es" ? "es" : "pt", study.susStatements)}
        sumEnabled={study.sumEnabled}
        sumStatements={asqStatementsFor(lang === "es" ? "es" : "pt", study.sumStatements)}
        sumAnchors={ASQ_ANCHORS[lang === "es" ? "es" : "pt"]}
        {...maps}
      />
    )
  }

  // Réplica precisa das imagens das telas (baixadas na importação).
  if (proto?.source === "figma" && screens.some((sc) => !sc.imageUrl)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <p className="max-w-md text-center text-body-medium text-on-surface-variant">
          Este teste ainda não está pronto: as telas do protótipo não foram carregadas. Avise quem
          compartilhou o link.
        </p>
      </div>
    )
  }

  return (
    <TestRunner
      token={token}
      preview={preview}
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

export function TesterThankYou({
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
