import { requireStudyView } from "@/lib/access"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { PrototypePlayer } from "@/components/preview/prototype-player"

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studyId } = await params
  const { isOwner } = await requireStudyView(studyId)

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
        where: { type: "mission" },
        orderBy: { order: "asc" },
        include: { mission: true },
      },
    },
  })
  if (!study) return null

  const screens = study.prototype?.screens ?? []
  const firstMission = study.blocks[0]?.mission ?? null

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
            Revisão do protótipo{isOwner ? "" : " — compartilhado com você"}
          </p>
        </div>
      </div>

      {screens.length === 0 ? (
        <div className="text-center py-24 border border-outline-variant rounded-3xl bg-surface-container-low text-on-surface-variant">
          Este estudo ainda não tem telas.
        </div>
      ) : (
        <PrototypePlayer
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
            })),
          }))}
          mission={
            firstMission
              ? {
                  task: firstMission.task,
                  description: firstMission.description,
                  startScreenId: firstMission.startScreenId,
                }
              : null
          }
        />
      )}
    </div>
  )
}
