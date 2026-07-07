import { requireStudyView } from "@/lib/access"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TestRunner, type Step } from "@/components/test/test-runner"
import { type Lang } from "@/lib/i18n"
import { CommentsBoard, type BoardComment } from "@/components/comments/comments-board"

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studyId } = await params
  const { userId, isOwner } = await requireStudyView(studyId)

  const study = await prisma.study.findUnique({
    where: { id: studyId },
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
  })
  if (!study) return null

  const screens = study.prototype?.screens ?? []
  const lang = (study.language ?? "pt") as Lang

  // Monta os passos do fluxo (idêntico ao testador): missões + perguntas.
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

  const reviewSteps: Step[] = study.blocks.flatMap((b): Step[] => {
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
          },
        },
        ...m.questions.map(toQuestionStep),
      ]
    }
    if (b.type === "question" && b.question) {
      return [toQuestionStep(b.question)]
    }
    return []
  })

  // Sem nenhuma missão, mas com telas: adiciona um passo de EXPLORAÇÃO LIVRE do
  // protótipo, para a revisão do fluxo não perder o protótipo.
  const hasMissionStep = reviewSteps.some((st) => st.kind === "mission")
  if (!hasMissionStep && screens.length > 0) {
    reviewSteps.unshift({
      kind: "mission",
      mission: {
        id: "__explore__",
        task: "Explore o protótipo",
        description: "Navegue livremente pelas telas para revisar o fluxo.",
        startScreenId: screens[0].id,
        goalScreenIds: [], // sem objetivo: avança pelo botão "Avançar"
      },
    })
  }

  const missionCount = reviewSteps.filter(
    (st) => st.kind === "mission" && st.mission.id !== "__explore__"
  ).length

  // Tarefas para o contexto dos comentários (âncoras: tela inicial + objetivos).
  const commentTasks = study.blocks
    .filter((b) => b.type === "mission" && b.mission)
    .map((b, i) => {
      const m = b.mission!
      const goalIds =
        m.successType === "path"
          ? m.paths
              .map((p) => p.steps[p.steps.length - 1]?.screenId)
              .filter((sid): sid is string => !!sid)
          : m.goals.map((g) => g.goalScreenId)
      const screenIds = [...new Set([m.startScreenId, ...goalIds])].filter((id) =>
        screens.some((s) => s.id === id)
      )
      return {
        id: m.id,
        label: `Tarefa ${i + 1}`,
        task: m.task,
        description: m.description,
        screenIds,
      }
    })

  const rawComments = await prisma.comment.findMany({
    where: { studyId, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  })

  const comments: BoardComment[] = rawComments
    .filter((c) => c.screenId && c.xNorm != null && c.yNorm != null)
    .map((c) => ({
      id: c.id,
      screenId: c.screenId!,
      xNorm: c.xNorm!,
      yNorm: c.yNorm!,
      body: c.body,
      resolved: c.resolved,
      authorName: c.author.name ?? c.author.email,
      authorId: c.author.id,
      replies: c.replies.map((r) => ({
        id: r.id,
        body: r.body,
        authorName: r.author.name ?? r.author.email,
        authorId: r.author.id,
      })),
    }))

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={isOwner ? `/studies/${studyId}` : "/projects"}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-title-large text-on-surface">{study.title}</h1>
          <p className="text-body-small text-on-surface-variant">
            Revisão{isOwner ? "" : " — compartilhado com você"}
          </p>
        </div>
      </div>

      {reviewSteps.length === 0 ? (
        <div className="text-center py-24 border border-outline-variant rounded-3xl bg-surface-container-low text-on-surface-variant">
          Este estudo ainda não tem tarefas ou perguntas.
        </div>
      ) : (
        <Tabs defaultValue="preview">
          <TabsList className="mb-6">
            <TabsTrigger value="preview">Fluxo completo</TabsTrigger>
            <TabsTrigger value="comments">Comentários ({comments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="preview">
            {/* Fluxo inteiro em modo revisão: boas-vindas → tarefas → perguntas →
                obrigado. Não grava nenhum dado (preview). */}
            <div className="rounded-3xl overflow-hidden border border-outline-variant">
              <TestRunner
                token=""
                lang={lang}
                preview
                welcome={{
                  title: study.welcomeTitle ?? "",
                  message: study.welcomeMessage ?? "",
                  taskCount: missionCount,
                }}
                howItWorks={study.howItWorks}
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
                    contentBox: r.contentBox as { x: number; y: number; w: number; h: number } | null,
                    pieces: r.pieces as { url: string; x: number; y: number; w: number; h: number }[] | null,
                  })),
                }))}
                steps={reviewSteps}
              />
            </div>
          </TabsContent>

          <TabsContent value="comments">
            <CommentsBoard
              studyId={studyId}
              currentUserId={userId}
              isOwner={isOwner}
              screens={screens.map((s) => ({ id: s.id, name: s.name, imageUrl: s.imageUrl }))}
              tasks={commentTasks}
              comments={comments}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
