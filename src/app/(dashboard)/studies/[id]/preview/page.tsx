import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { PrototypePlayer } from "@/components/preview/prototype-player"

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studyId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const study = await prisma.study.findUnique({
    where: { id: studyId, ownerId: session.user.id },
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

  if (!study || !study.prototype) notFound()

  const screens = study.prototype.screens
  const firstMission = study.blocks[0]?.mission ?? null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/studies/${studyId}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-semibold">{study.title}</h1>
          <p className="text-xs text-muted-foreground">
            Preview — sem gravação de dados
          </p>
        </div>
      </div>

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
            contentBox: r.contentBox as { x: number; y: number; w: number; h: number } | null,
            pieces: r.pieces as { url: string; x: number; y: number; w: number; h: number }[] | null,
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
    </div>
  )
}
