import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { HotspotEditor } from "@/components/prototype/hotspot-editor"
import { saveHotspotsAction } from "./actions"

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href={`/studies/${studyId}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs text-muted-foreground">
            {screen.prototype.study.title}
          </p>
          <h1 className="font-semibold">{screen.name}</h1>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <HotspotEditor
          screenId={screenId}
          imageUrl={screen.imageUrl}
          otherScreens={otherScreens.map((s) => ({
            id: s.id,
            name: s.name,
            order: s.order,
          }))}
          initialHotspots={screen.hotspots.map((h) => ({
            id: h.id,
            coords: h.coords,
            targetScreenId: h.targetScreenId,
          }))}
          onSave={save}
        />
      </div>
    </div>
  )
}
