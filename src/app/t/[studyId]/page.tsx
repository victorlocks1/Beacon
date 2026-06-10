import { prisma } from "@/lib/db"
import { startSessionAction } from "./actions"
import { Button } from "@/components/ui/button"
import { ClipboardCheck, MousePointerClick, Clock } from "lucide-react"
import { tt, type Lang } from "@/lib/i18n"

export default async function TestEntryPage({
  params,
}: {
  params: Promise<{ studyId: string }>
}) {
  const { studyId } = await params

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    include: {
      blocks: { where: { type: "mission" } },
    },
  })

  const s = tt((study?.language ?? "pt") as Lang)

  if (!study || study.status !== "live") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant p-10 text-center">
          <h1 className="text-title-large text-on-surface">{s.unavailableTitle}</h1>
          <p className="text-body-medium text-on-surface-variant mt-2">
            {s.unavailableBody}
          </p>
        </div>
      </div>
    )
  }

  const missionCount = study.blocks.length
  const start = startSessionAction.bind(null, studyId)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary mb-1">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <h1 className="text-headline-small text-on-surface">{s.welcomeTitle}</h1>
          <p className="text-body-medium text-on-surface-variant">
            {s.welcomeIntro}
          </p>
        </div>

        <div className="space-y-4 text-body-medium text-on-surface">
          <div className="flex items-start gap-3">
            <MousePointerClick className="h-5 w-5 mt-0.5 text-on-surface-variant shrink-0" />
            <span>{s.tasksCount(missionCount)}</span>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 mt-0.5 text-on-surface-variant shrink-0" />
            <span>{s.anonymous}</span>
          </div>
        </div>

        <form action={start}>
          <Button type="submit" className="w-full h-12" size="lg">
            {s.start}
          </Button>
        </form>
      </div>
    </div>
  )
}
