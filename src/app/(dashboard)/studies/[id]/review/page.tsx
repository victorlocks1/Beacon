import { requireStudyView } from "@/lib/access"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type Lang } from "@/lib/i18n"
import { CommentsBoard, type BoardComment } from "@/components/comments/comments-board"
import { ReviewStage } from "@/components/review/review-stage"
import { TesterRun, testerStudyInclude } from "@/components/test/tester-flow"

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studyId } = await params
  const { userId, isOwner } = await requireStudyView(studyId)

  // mesma consulta do link do testador (o fluxo é o mesmo componente)
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    include: testerStudyInclude,
  })
  if (!study) return null

  const screens = study.prototype?.screens ?? []
  const lang = (study.language ?? "pt") as Lang

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
    <div className="max-w-7xl mx-auto">
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

      {study.blocks.length === 0 ? (
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
            {/* A MESMA página do participante: cartão de entrada + fluxo. Só não
                grava nada (preview). */}
            <ReviewStage
              entry={{
                lang,
                welcomeTitle: study.welcomeTitle,
                welcomeMessage: study.welcomeMessage,
                howItWorks: study.howItWorks,
              }}
            >
              <TesterRun study={study} token="" preview />
            </ReviewStage>
          </TabsContent>

          <TabsContent value="comments">
            <CommentsBoard
              studyId={studyId}
              currentUserId={userId}
              isOwner={isOwner}
              deviceType={(study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
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
