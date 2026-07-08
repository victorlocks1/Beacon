import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScreenUploadForm } from "@/components/prototype/screen-upload-form"
import { FigmaImportDialog } from "@/components/prototype/figma-import-dialog"
import { DeleteAllScreensButton } from "@/components/prototype/delete-all-screens-button"
import { RefreshFigmaButton } from "@/components/prototype/refresh-figma-button"
import { SubmitButton } from "@/components/submit-button"
import { MissionSavedToast } from "@/components/study/mission-saved-toast"
import { EditableScreenName } from "@/components/prototype/editable-screen-name"
import { EditableStudyTitle } from "@/components/study/editable-study-title"
import { deleteScreenAction, moveScreenAction } from "./actions"
import { StudyBuilder, type BuilderBlock } from "@/components/study/builder/study-builder"
import { StudyHeaderActions } from "@/components/study/study-header-actions"
import { tt, type Lang } from "@/lib/i18n"
import { susStatementsFor, SUS_STATEMENTS, SUS_OPTIONS } from "@/lib/sus"
import {
  ArrowLeft,
  Trash2,
  MousePointerClick,
  ChevronUp,
  ChevronDown,
} from "lucide-react"

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; tab?: string; block?: string }>
}) {
  const { id } = await params
  const { error, tab, block } = await searchParams
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
              questions: { orderBy: { order: "asc" } },
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

  const builderBlocks: BuilderBlock[] = blocks
    .map((b): BuilderBlock | null => {
      if (b.type === "mission" && b.mission) {
        const m = b.mission
        return {
          id: b.id,
          kind: "mission",
          missionId: m.id,
          task: m.task,
          startScreenId: m.startScreenId,
          initial: {
            task: m.task,
            description: m.description,
            successType: m.successType as "screen" | "path",
            startScreenId: m.startScreenId,
            goalScreenId: m.goals[0]?.goalScreenId ?? null,
            paths: m.paths.map((p) => p.steps.map((s) => s.screenId)),
            questions: m.questions.map((q) => ({
              type: q.type as "open" | "choice" | "rating" | "binary",
              title: q.title,
              description: q.description,
              required: q.required,
              options: (q.options as string[] | null) ?? [],
            })),
          },
        }
      }
      if (b.type === "question" && b.question) {
        const q = b.question
        return {
          id: b.id,
          kind: "question",
          questionId: q.id,
          title: q.title,
          qtype: q.type,
          initial: {
            type: q.type as "open" | "choice" | "rating" | "binary",
            title: q.title,
            description: q.description,
            required: q.required,
            options: (q.options as string[] | null) ?? [],
          },
        }
      }
      if (b.type === "sus") return { id: b.id, kind: "sus" }
      return null
    })
    .filter((b): b is BuilderBlock => b !== null)

  const missionScreens = screens.map((sc) => ({
    id: sc.id,
    name: sc.name,
    order: sc.order,
    imageUrl: sc.imageUrl,
    width: sc.width,
    height: sc.height,
    scroll: sc.scroll as "none" | "vertical" | "horizontal" | "both",
    figmaNodeId: sc.figmaNodeId,
    hotspots: sc.hotspots.map((h) => ({
      id: h.id,
      coords: h.coords as { x: number; y: number; w: number; h: number },
      action: h.action as "navigate" | "open_overlay" | "close_overlay" | "back",
      overlayPosition: h.overlayPosition as "bottom" | "center" | null,
      targetScreenId: h.targetScreenId,
    })),
  }))
  const builderFigmaKey = study.prototype?.source === "figma" ? study.prototype.figmaFileKey : null
  const susLang = (study.language ?? "pt") === "es" ? "es" : "pt"

  // Estudo "ao vivo" fica somente-leitura para não distorcer o relatório
  const editable = study.status !== "live"
  const activeTab = tab === "missions" ? "missions" : "prototype"

  return (
    <div className="max-w-[1500px] mx-auto lg:h-[calc(100svh-8rem)] lg:flex lg:flex-col lg:min-h-0">
      <Suspense fallback={null}>
        <MissionSavedToast />
      </Suspense>
      {error && (
        <div className="mb-6 rounded-2xl border border-error/30 bg-error-container px-5 py-4 text-body-medium text-on-error-container lg:shrink-0">
          {decodeURIComponent(error)}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 lg:shrink-0">
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
          members={study.members.map((m) => ({
            userId: m.user.id,
            name: m.user.name ?? m.user.email,
            email: m.user.email,
          }))}
        />
      </div>

      {!editable && (
        <div className="mb-6 rounded-2xl border border-outline-variant bg-surface-container px-5 py-4 text-body-medium text-on-surface-variant lg:shrink-0">
          Estudo <strong className="text-on-surface font-medium">ao vivo</strong> — a edição está bloqueada para não
          distorcer os resultados. Use <strong className="text-on-surface font-medium">Encerrar</strong> para fazer
          alterações.
        </div>
      )}

      <Tabs defaultValue={activeTab} className="lg:flex-1 lg:min-h-0">
        <div className="mb-8 lg:shrink-0">
          <TabsList>
            <TabsTrigger value="prototype">Protótipo</TabsTrigger>
            <TabsTrigger value="missions">Missões</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Protótipo ── */}
        <TabsContent value="prototype" className="lg:min-h-0 lg:overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title-medium text-on-surface">
              {screens.length} {screens.length === 1 ? "tela" : "telas"}
            </h2>
            {editable && screens.length > 0 && (
              <div className="flex items-center gap-2">
                {study.prototype?.source === "figma" && (
                  <RefreshFigmaButton studyId={study.id} />
                )}
                <DeleteAllScreensButton studyId={study.id} screenCount={screens.length} />
              </div>
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
                    {/* Thumbnail — no import ao vivo a tela não tem imagem (o
                        embed renderiza); mostra um placeholder em vez de quebrar. */}
                    <div className="relative w-20 h-14 rounded overflow-hidden bg-surface-container-high shrink-0 flex items-center justify-center">
                      {screen.imageUrl ? (
                        <Image src={screen.imageUrl} alt={screen.name} fill className="object-cover" />
                      ) : (
                        <span className="text-[10px] text-on-surface-variant text-center px-1 leading-tight">
                          Figma ao vivo
                        </span>
                      )}
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
                        <SubmitButton variant="ghost" size="icon" fullWidth={false} className="h-7 w-7" disabled={index === 0}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </SubmitButton>
                      </form>
                      <form action={moveScreenAction.bind(null, study.id, screen.id, "down")}>
                        <SubmitButton variant="ghost" size="icon" fullWidth={false} className="h-7 w-7" disabled={index === screens.length - 1}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </SubmitButton>
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
                        <SubmitButton variant="ghost" size="icon" fullWidth={false} className="h-8 w-8 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
                        </SubmitButton>
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

        {/* ── Sequência (builder em 3 colunas: blocos · editor · preview) ── */}
        <TabsContent value="missions" className="lg:min-h-0">
          <StudyBuilder
            studyId={study.id}
            editable={editable}
            deviceType={(study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
            initialSelection={block}
            welcome={{
              title: study.welcomeTitle,
              message: study.welcomeMessage,
              howItWorks: study.howItWorks,
              defaultTitle: tt((study.language ?? "pt") as Lang).welcomeTitle,
            }}
            thanks={{
              title: study.thanksTitle,
              message: study.thanksMessage,
              defaultTitle: tt((study.language ?? "pt") as Lang).thanksTitle,
              defaultMessage: tt((study.language ?? "pt") as Lang).thanksBody,
            }}
            blocks={builderBlocks}
            missionScreens={missionScreens}
            figmaFileKey={builderFigmaKey}
            sus={{
              statements: susStatementsFor(susLang, study.susStatements),
              scaleOptions: SUS_OPTIONS[susLang],
              defaultStatements: SUS_STATEMENTS[susLang],
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
