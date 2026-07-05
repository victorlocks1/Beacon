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
import { DeleteAllScreensButton } from "@/components/prototype/delete-all-screens-button"
import { EditableScreenName } from "@/components/prototype/editable-screen-name"
import { EditableStudyTitle } from "@/components/study/editable-study-title"
import { deleteScreenAction, moveScreenAction } from "./actions"
import { QuestionDialog } from "@/components/question/question-dialog"
import { SequenceList, type SeqBlock } from "@/components/study/sequence-list"
import { WelcomeDialog } from "@/components/study/welcome-dialog"
import { StudyHeaderActions } from "@/components/study/study-header-actions"
import { tt, type Lang } from "@/lib/i18n"
import {
  ArrowLeft,
  Trash2,
  MousePointerClick,
  Plus,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Tablet,
  Monitor,
} from "lucide-react"

const deviceIcon = { mobile: Smartphone, tablet: Tablet, desktop: Monitor }
const deviceLabel = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" }

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
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })

  if (!study) notFound()

  const screens = study.prototype?.screens ?? []
  const blocks = study.blocks
  const missions = study.blocks
    .filter((b) => b.type === "mission" && b.mission)
    .map((b) => b.mission!)

  const seqBlocks: SeqBlock[] = blocks
    .map((b): SeqBlock | null => {
      if (b.type === "mission" && b.mission) {
        const m = b.mission
        return {
          id: b.id,
          kind: "mission",
          missionId: m.id,
          task: m.task,
          description: m.description,
          startScreenName: m.startScreen.name,
          successType: m.successType as "screen" | "path",
          goalScreenName: m.goals[0]?.goalScreen.name ?? null,
          pathsCount: m.paths.length,
        }
      }
      if (b.type === "question" && b.question) {
        const q = b.question
        return {
          id: b.id,
          kind: "question",
          questionId: q.id,
          qtype: q.type as "open" | "choice" | "rating" | "binary",
          title: q.title,
          description: q.description,
          required: q.required,
          options: (q.options as string[] | null) ?? [],
        }
      }
      return null
    })
    .filter((b): b is SeqBlock => b !== null)

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
        <StudyHeaderActions
          studyId={study.id}
          status={study.status as "draft" | "live" | "closed"}
          canPublish={screens.length > 0 && missions.length > 0}
          shareCode={study.shareCode}
          deviceType={study.deviceType ?? "desktop"}
          language={study.language ?? "pt"}
          members={study.members.map((m) => ({
            userId: m.user.id,
            name: m.user.name ?? m.user.email,
            email: m.user.email,
          }))}
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
            <TabsTrigger value="missions">Missões</TabsTrigger>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title-medium text-on-surface">
              {screens.length} {screens.length === 1 ? "tela" : "telas"}
            </h2>
            {editable && screens.length > 0 && (
              <DeleteAllScreensButton studyId={study.id} screenCount={screens.length} />
            )}
          </div>
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
          {(() => {
            const s = tt((study.language ?? "pt") as Lang)
            const wTitle = study.welcomeTitle || s.welcomeTitle
            const wMsg = study.welcomeMessage || s.welcomeIntro
            return (
              <div className="mb-6 rounded-2xl border border-outline-variant bg-surface-container-low p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label-medium text-on-surface-variant mb-1">
                      TELA DE BOAS-VINDAS
                    </p>
                    <h3 className="text-title-medium text-on-surface">{wTitle}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{wMsg}</p>
                  </div>
                  {editable && (
                    <WelcomeDialog
                      studyId={study.id}
                      title={study.welcomeTitle}
                      message={study.welcomeMessage}
                      defaultTitle={s.welcomeTitle}
                      defaultMessage={s.welcomeIntro}
                    />
                  )}
                </div>
              </div>
            )
          })()}

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
            <>
              {editable && (
                <p className="text-xs text-muted-foreground mb-3">
                  Arraste pelos <span className="align-middle">⠿</span> para reordenar a sequência.
                </p>
              )}
              <SequenceList studyId={study.id} editable={editable} blocks={seqBlocks} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
