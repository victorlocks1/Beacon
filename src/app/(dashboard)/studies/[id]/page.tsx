import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScreenUploadForm } from "@/components/prototype/screen-upload-form"
import { FigmaImportDialog } from "@/components/prototype/figma-import-dialog"
import { EditableScreenName } from "@/components/prototype/editable-screen-name"
import { EditableStudyTitle } from "@/components/study/editable-study-title"
import { PublishBar } from "@/components/study/publish-bar"
import {
  deleteScreenAction,
  moveScreenAction,
  deleteMissionAction,
  deleteQuestionAction,
  moveBlockAction,
} from "./actions"
import { QuestionDialog } from "@/components/question/question-dialog"
import {
  ArrowLeft,
  Trash2,
  Pencil,
  MousePointerClick,
  Eye,
  Plus,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Tablet,
  Monitor,
  BarChart3,
  Target,
  Route,
} from "lucide-react"

const deviceIcon = { mobile: Smartphone, tablet: Tablet, desktop: Monitor }
const deviceLabel = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" }
const qTypeLabel: Record<string, string> = {
  open: "Pergunta aberta",
  choice: "Múltipla escolha",
  rating: "Avaliação por estrelas",
  binary: "Sim / Não",
}

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; tab?: string }>
}) {
  const { id } = await params
  const { error, tab } = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const study = await prisma.study.findUnique({
    where: { id, ownerId: session.user.id },
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
        orderBy: { order: "asc" },
        include: {
          mission: {
            include: {
              startScreen: true,
              goals: { include: { goalScreen: true } },
              paths: {
                include: {
                  steps: {
                    orderBy: { order: "asc" },
                    include: { screen: true },
                  },
                },
              },
            },
          },
          question: true,
        },
      },
    },
  })

  if (!study) notFound()

  const screens = study.prototype?.screens ?? []
  const blocks = study.blocks
  const missions = study.blocks
    .filter((b) => b.type === "mission" && b.mission)
    .map((b) => b.mission!)

  // Estudo "ao vivo" fica somente-leitura para não distorcer o relatório
  const editable = study.status !== "live"
  const activeTab = tab === "missions" ? "missions" : "prototype"

  return (
    <div className="max-w-5xl mx-auto">
      {error && (
        <div className="mb-6 rounded-2xl border border-error/30 bg-error-container px-5 py-4 text-body-medium text-on-error-container">
          {decodeURIComponent(error)}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/projects/${study.projectId}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <EditableStudyTitle studyId={study.id} initialTitle={study.title} />
        </div>
        <Link href={`/studies/${study.id}/results`} className={buttonVariants({ variant: "outline" })}>
          <BarChart3 className="h-4 w-4 mr-2" />
          Resultados
        </Link>
        {screens.length > 0 && (
          <Link href={`/studies/${study.id}/preview`} className={buttonVariants({ variant: "outline" })}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Link>
        )}
        <PublishBar
          studyId={study.id}
          status={study.status as "draft" | "live" | "closed"}
          canPublish={screens.length > 0 && missions.length > 0}
        />
      </div>

      {!editable && (
        <div className="mb-6 rounded-2xl border border-outline-variant bg-surface-container px-5 py-4 text-body-medium text-on-surface-variant">
          Estudo <strong className="text-on-surface font-medium">ao vivo</strong> — a edição está bloqueada para não
          distorcer os resultados. Use <strong className="text-on-surface font-medium">Encerrar</strong> para fazer
          alterações.
        </div>
      )}

      <Tabs defaultValue={activeTab}>
        <div className="flex items-center justify-between gap-3 mb-8">
          <TabsList>
            <TabsTrigger value="prototype">Protótipo</TabsTrigger>
            <TabsTrigger value="missions">Sequência</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Badge variant={study.status === "live" ? "default" : "secondary"}>
              {study.status === "draft"
                ? "Rascunho"
                : study.status === "live"
                  ? "Ao vivo"
                  : "Encerrado"}
            </Badge>
            {(() => {
              const dt = (study.deviceType ?? "desktop") as "mobile" | "tablet" | "desktop"
              const Icon = deviceIcon[dt]
              return (
                <Badge variant="outline" className="gap-1 font-normal">
                  <Icon className="h-3 w-3" />
                  {deviceLabel[dt]}
                </Badge>
              )
            })()}
          </div>
        </div>

        {/* ── Protótipo ── */}
        <TabsContent value="prototype">
          <h2 className="text-title-medium text-on-surface mb-4">
            {screens.length} {screens.length === 1 ? "tela" : "telas"}
          </h2>
          {screens.length === 0 ? (
            /* Sem telas: upload + importar do Figma */
            <div className="space-y-4">
              <ScreenUploadForm studyId={study.id} />
              <div className="flex items-center gap-3 text-label-medium text-on-surface-variant">
                <span className="h-px flex-1 bg-outline-variant" />
                ou
                <span className="h-px flex-1 bg-outline-variant" />
              </div>
              <div className="flex justify-center">
                <FigmaImportDialog studyId={study.id} />
              </div>
            </div>
          ) : (
            /* Com telas: duas colunas (uma só quando bloqueado) */
            <div className={editable ? "grid grid-cols-[1fr_280px] gap-5 items-start" : ""}>
              {/* Esquerda: lista de telas */}
              <div className="space-y-2">
                {screens.map((screen, index) => (
                  <div
                    key={screen.id}
                    className="flex items-center gap-4 border border-outline-variant rounded-2xl p-4 bg-surface-container-low"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-20 h-14 rounded overflow-hidden bg-muted shrink-0">
                      <Image
                        src={screen.imageUrl}
                        alt={screen.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {editable ? (
                        <EditableScreenName
                          screenId={screen.id}
                          studyId={study.id}
                          initialName={screen.name}
                        />
                      ) : (
                        <p className="text-sm font-medium truncate">{screen.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {screen.hotspots.length} hotspot(s) · {screen.width}×{screen.height}
                      </p>
                    </div>

                    {/* Actions */}
                    {editable && (
                    <div className="flex items-center gap-1 shrink-0">
                      <form action={moveScreenAction.bind(null, study.id, screen.id, "up")}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} type="submit">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                      <form action={moveScreenAction.bind(null, study.id, screen.id, "down")}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === screens.length - 1} type="submit">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </form>

                      <Separator orientation="vertical" className="h-5 mx-1" />

                      <Link
                        href={`/studies/${study.id}/screens/${screen.id}/hotspots`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <MousePointerClick className="h-3.5 w-3.5 mr-1.5" />
                        Hotspots
                      </Link>

                      <form action={deleteScreenAction.bind(null, study.id, screen.id)}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" type="submit">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Direita: upload + importar do Figma */}
              {editable && (
                <div className="sticky top-4 space-y-3">
                  <ScreenUploadForm studyId={study.id} />
                  <FigmaImportDialog studyId={study.id} />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Sequência (missões + perguntas) ── */}
        <TabsContent value="missions">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-title-medium text-on-surface">
                {blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Tarefas e perguntas na ordem que o testador vê.
              </p>
            </div>
            {editable && (
              <div className="flex items-center gap-2 shrink-0">
                <QuestionDialog studyId={study.id} variant="create" />
                {screens.length > 0 ? (
                  <Link href={`/studies/${study.id}/missions/new`} className={buttonVariants()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova missão
                  </Link>
                ) : (
                  <Button disabled title="Adicione telas primeiro">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova missão
                  </Button>
                )}
              </div>
            )}
          </div>

          {blocks.length === 0 ? (
            <div className="text-center py-20 border border-outline-variant rounded-3xl bg-surface-container-low">
              <p className="text-title-medium text-on-surface">Sequência vazia</p>
              <p className="text-body-medium text-on-surface-variant mt-1.5">
                {screens.length === 0
                  ? "Adicione telas ao protótipo e crie a primeira tarefa"
                  : "Adicione uma missão ou uma pergunta para começar"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {blocks.map((block, index) => {
                const moveControls = editable && (
                  <div className="flex flex-col -my-1">
                    <form action={moveBlockAction.bind(null, study.id, block.id, "up")}>
                      <Button variant="ghost" size="icon-sm" type="submit" disabled={index === 0} title="Subir">
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </form>
                    <form action={moveBlockAction.bind(null, study.id, block.id, "down")}>
                      <Button variant="ghost" size="icon-sm" type="submit" disabled={index === blocks.length - 1} title="Descer">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                )

                if (block.type === "mission" && block.mission) {
                  const mission = block.mission
                  return (
                    <div key={block.id} className="border border-outline-variant rounded-2xl p-5 bg-surface-container-low">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-label-medium text-on-surface-variant mb-1">
                            PASSO {index + 1} · TAREFA
                          </p>
                          <h3 className="text-title-medium text-on-surface">{mission.task}</h3>
                          {mission.description && (
                            <p className="text-sm text-muted-foreground mt-1">{mission.description}</p>
                          )}
                        </div>
                        {editable && (
                          <div className="flex items-center gap-1 shrink-0">
                            {moveControls}
                            <Link
                              href={`/studies/${study.id}/missions/${mission.id}/edit`}
                              className={buttonVariants({ variant: "ghost", size: "icon" })}
                              title="Editar missão"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <form action={deleteMissionAction.bind(null, study.id, mission.id)}>
                              <Button variant="ghost" size="icon" type="submit" className="text-muted-foreground hover:text-red-500" title="Excluir missão">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          </div>
                        )}
                      </div>
                      <Separator className="my-3" />
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                        <span>
                          Início: <span className="text-foreground font-medium">{mission.startScreen.name}</span>
                        </span>
                        {mission.successType === "screen" ? (
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Tela-alvo: <span className="text-foreground font-medium">{mission.goals[0]?.goalScreen.name ?? "—"}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Route className="h-3 w-3" />
                            Caminho exato: <span className="text-foreground font-medium">{mission.paths.length} caminho(s)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                }

                if (block.type === "question" && block.question) {
                  const q = block.question
                  const opts = (q.options as string[] | null) ?? []
                  return (
                    <div key={block.id} className="border border-outline-variant rounded-2xl p-5 bg-surface-container-low">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-label-medium text-on-surface-variant mb-1">
                            PASSO {index + 1} · PERGUNTA
                          </p>
                          <h3 className="text-title-medium text-on-surface">{q.title}</h3>
                          {q.description && (
                            <p className="text-sm text-muted-foreground mt-1">{q.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary">{qTypeLabel[q.type]}</Badge>
                            {q.type === "choice" && (
                              <span className="text-xs text-muted-foreground">{opts.length} opções</span>
                            )}
                            {!q.required && (
                              <span className="text-xs text-muted-foreground">opcional</span>
                            )}
                          </div>
                        </div>
                        {editable && (
                          <div className="flex items-center gap-1 shrink-0">
                            {moveControls}
                            <QuestionDialog
                              studyId={study.id}
                              questionId={q.id}
                              variant="edit"
                              initial={{
                                type: q.type as "open" | "choice" | "rating" | "binary",
                                title: q.title,
                                description: q.description,
                                required: q.required,
                                options: opts,
                              }}
                            />
                            <form action={deleteQuestionAction.bind(null, study.id, q.id)}>
                              <Button variant="ghost" size="icon" type="submit" className="text-muted-foreground hover:text-red-500" title="Excluir pergunta">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
