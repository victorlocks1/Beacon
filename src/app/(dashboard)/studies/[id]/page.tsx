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
import { DeviceTypeSelector } from "@/components/prototype/device-type-selector"
import { deleteScreenAction, moveScreenAction } from "./actions"
import {
  ArrowLeft,
  Trash2,
  MousePointerClick,
  Eye,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react"

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
        </div>
        {screens.length > 0 && (
          <Link href={`/studies/${study.id}/preview`} className={buttonVariants({ variant: "outline" })}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Link>
        )}
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
          <div className="flex items-center justify-between mb-4">
            <DeviceTypeSelector
              studyId={study.id}
              current={(study.prototype?.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
            />
          </div>
          <ScreenUploadForm studyId={study.id} />

          {screens.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
              <p className="text-base font-medium">Nenhuma tela ainda</p>
              <p className="text-sm mt-1">
                Clique em "Adicionar telas" para fazer upload das imagens
              </p>
            </div>
          ) : (
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
                    {/* Reorder */}
                    <form action={moveScreenAction.bind(null, study.id, screen.id, "up")}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        type="submit"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                    <form action={moveScreenAction.bind(null, study.id, screen.id, "down")}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === screens.length - 1}
                        type="submit"
                      >
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

                    <form
                      action={deleteScreenAction.bind(null, study.id, screen.id)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        type="submit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
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
                  <div className="flex items-start justify-between">
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
                  </div>
                  <Separator className="my-3" />
                  <div className="flex gap-6 text-xs text-muted-foreground">
                    <span>
                      Início:{" "}
                      <span className="text-foreground font-medium">
                        {mission.startScreen.name}
                      </span>
                    </span>
                    {mission.goals[0] && (
                      <span>
                        Sucesso:{" "}
                        <span className="text-foreground font-medium">
                          {mission.goals[0].goalScreen.name}
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
