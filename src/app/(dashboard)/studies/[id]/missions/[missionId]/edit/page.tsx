import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { MissionForm } from "@/components/mission/mission-form"

export default async function EditMissionPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>
}) {
  const { id: studyId, missionId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const study = await prisma.study.findUnique({
    where: { id: studyId, ownerId: session.user.id },
    include: {
      prototype: {
        include: {
          screens: { orderBy: { order: "asc" }, include: { hotspots: true, scrollRegions: true } },
        },
      },
    },
  })
  if (!study) notFound()

  const mission = await prisma.mission.findFirst({
    where: { id: missionId, block: { studyId } },
    include: {
      goals: true,
      paths: { include: { steps: { orderBy: { order: "asc" } } } },
      questions: { orderBy: { order: "asc" } },
    },
  })
  if (!mission) notFound()

  const screens = study.prototype?.screens ?? []

  const initial = {
    task: mission.task,
    description: mission.description,
    successType: mission.successType as "screen" | "path",
    startScreenId: mission.startScreenId,
    goalScreenId: mission.goals[0]?.goalScreenId ?? null,
    paths: mission.paths.map((p) => p.steps.map((s) => s.screenId)),
    questions: mission.questions.map((q) => ({
      type: q.type as "open" | "choice" | "rating" | "binary",
      title: q.title,
      description: q.description,
      required: q.required,
      options: (q.options as string[] | null) ?? [],
    })),
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/studies/${studyId}?tab=missions`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-headline-small text-on-surface">Editar missão</h1>
      </div>

      <MissionForm
        studyId={studyId}
        missionId={missionId}
        initial={initial}
        deviceType={(study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
        figmaFileKey={study.prototype?.source === "figma" ? study.prototype.figmaFileKey : null}
        screens={screens.map((s) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          imageUrl: s.imageUrl,
          width: s.width,
          height: s.height,
          scroll: s.scroll as "none" | "vertical" | "horizontal" | "both",
          figmaNodeId: s.figmaNodeId,
          hotspots: s.hotspots.map((h) => ({
            id: h.id,
            coords: h.coords as { x: number; y: number; w: number; h: number },
            action: h.action as "navigate" | "open_overlay" | "close_overlay" | "back",
            overlayPosition: h.overlayPosition as "bottom" | "center" | null,
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
      />
    </div>
  )
}
