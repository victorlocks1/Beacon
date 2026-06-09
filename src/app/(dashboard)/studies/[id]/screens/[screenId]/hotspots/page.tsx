import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { HotspotEditor } from "@/components/prototype/hotspot-editor"
import {
  saveHotspotsAction,
  updateScreenScrollAction,
  saveScrollRegionsAction,
  uploadScrollStripAction,
} from "./actions"
import type { ScrollMode } from "@/lib/device"

export default async function HotspotsPage({
  params,
}: {
  params: Promise<{ id: string; screenId: string }>
}) {
  const { id: studyId, screenId } = await params
  const session = await auth()
  if (!session) redirect("/login")

  const screen = await prisma.screen.findFirst({
    where: { id: screenId, prototype: { studyId } },
    include: {
      hotspots: true,
      scrollRegions: true,
      prototype: {
        include: {
          screens: { orderBy: { order: "asc" } },
          study: true,
        },
      },
    },
  })

  if (!screen || screen.prototype.study.ownerId !== session.user.id) notFound()

  const otherScreens = screen.prototype.screens.filter((s) => s.id !== screenId)

  async function save(hotspots: Parameters<typeof saveHotspotsAction>[2]) {
    "use server"
    await saveHotspotsAction(studyId, screenId, hotspots)
  }

  async function saveRegions(regions: Parameters<typeof saveScrollRegionsAction>[2]) {
    "use server"
    await saveScrollRegionsAction(studyId, screenId, regions)
  }

  async function uploadStrip(formData: FormData) {
    "use server"
    return uploadScrollStripAction(studyId, screenId, formData)
  }

  async function changeScroll(scroll: ScrollMode) {
    "use server"
    await updateScreenScrollAction(studyId, screenId, scroll)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href={`/studies/${studyId}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-label-medium text-on-surface-variant">
            {screen.prototype.study.title}
          </p>
          <h1 className="text-title-large text-on-surface">{screen.name}</h1>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <HotspotEditor
          screenId={screenId}
          imageUrl={screen.imageUrl}
          deviceType={(screen.prototype.study.deviceType ?? "desktop") as "desktop" | "tablet" | "mobile"}
          initialScroll={(screen.scroll ?? "none") as ScrollMode}
          otherScreens={otherScreens.map((s) => ({
            id: s.id,
            name: s.name,
            order: s.order,
          }))}
          initialHotspots={screen.hotspots.map((h) => ({
            id: h.id,
            coords: h.coords,
            action: h.action as "navigate" | "open_overlay" | "close_overlay" | "back",
            overlayPosition: h.overlayPosition as "bottom" | "center" | null,
            targetScreenId: h.targetScreenId,
          }))}
          initialRegions={screen.scrollRegions.map((r) => ({
            id: r.id,
            coords: r.coords,
            axis: r.axis as "horizontal" | "vertical" | "both",
            imageUrl: r.imageUrl,
          }))}
          onSave={save}
          onSaveRegions={saveRegions}
          onUploadStrip={uploadStrip}
          onScrollChange={changeScroll}
        />
      </div>
    </div>
  )
}
