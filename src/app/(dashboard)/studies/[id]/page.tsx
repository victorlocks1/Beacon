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
import { EditableScreenName } from "@/components/prototype/editable-screen-name"
import { PublishBar } from "@/components/study/publish-bar"
import { deleteScreenAction, moveScreenAction, deleteMissionAction } from "./actions"
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

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const session = await auth()
  if (!session) redirect("/login")

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
        },
      },
    },
  })

  if (!study) notFound()

  const screens = study.prototype?.screens ?? []
  const missions = study.blocks
    .filter((b) => b.type === "mission" && b.mission)
    .map((b) => b.mission!)

  return (
    <div className="max-w-5xl mx-auto">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/studies" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-xl font-bold">{study.title}</h1>
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

      <Tabs defaultValue="prototype">
        <TabsList className="mb-6">
          <TabsTrigger value="prototype">
            Protótipo ({screens.length} telas)
          </TabsTrigger>
          <TabsTrigger value="missions">
            Missões ({missions.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Protótipo ── */}
        <TabsContent value="prototype">
          {screens.length === 0 ? (
            /* Sem telas: upload ocupa tudo */
            <ScreenUploadForm studyId={study.id} />
          ) : (
            /* Com telas: duas colunas */
            <div className="grid grid-cols-[1fr_280px] gap-5 items-start">
              {/* Esquerda: lista de telas */}
              <div className="space-y-2">
                {screens.map((screen, index) => (
                  <div
                    key={screen.id}
                    className="flex items-center gap-3 border rounded-lg p-3"
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
                      <EditableScreenName
                        screenId={screen.id}
                        studyId={study.id}
                        initialName={screen.name}
                      />
                      <p className="text-xs text-muted-foreground">
                        {screen.hotspots.length} hotspot(s) · {screen.width}×{screen.height}
                      </p>
                    </div>

                    {/* Actions */}
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
                  </div>
                ))}
              </div>

              {/* Direita: upload */}
              <div className="sticky top-4">
                <ScreenUploadForm studyId={study.id} />
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Missões ── */}
        <TabsContent value="missions">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Defina o que o testador deve realizar no protótipo.
            </p>
            {screens.length > 0 ? (
              <Link href={`/studies/${study.id}/missions/new`} className={buttonVariants()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova missão
              </Link>
            ) : (
              <Button disabled>
                <Plus className="h-4 w-4 mr-2" />
                Nova missão
              </Button>
            )}
          </div>

          {missions.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
              <p className="text-base font-medium">Nenhuma missão ainda</p>
              <p className="text-sm mt-1">
                {screens.length === 0
                  ? "Adicione telas ao protótipo primeiro"
                  : "Clique em \"Nova missão\" para criar a primeira tarefa"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {missions.map((mission, index) => (
                <div key={mission.id} className="border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Missão {index + 1}
                      </p>
                      <h3 className="font-semibold">{mission.task}</h3>
                      {mission.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {mission.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/studies/${study.id}/missions/${mission.id}/edit`}
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        title="Editar missão"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <form action={deleteMissionAction.bind(null, study.id, mission.id)}>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="submit"
                          className="text-muted-foreground hover:text-red-500"
                          title="Excluir missão"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    <span>
                      Início:{" "}
                      <span className="text-foreground font-medium">
                        {mission.startScreen.name}
                      </span>
                    </span>
                    {mission.successType === "screen" ? (
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Tela-alvo:{" "}
                        <span className="text-foreground font-medium">
                          {mission.goals[0]?.goalScreen.name ?? "—"}
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Route className="h-3 w-3" />
                        Caminho exato:{" "}
                        <span className="text-foreground font-medium">
                          {mission.paths.length} caminho(s)
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
