import { prisma } from "@/lib/db"
import { startSessionAction } from "./actions"
import { SubmitButton } from "@/components/submit-button"
import { ClipboardCheck } from "lucide-react"
import { tt, type Lang } from "@/lib/i18n"

export default async function TestEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>
  searchParams: Promise<{ live?: string }>
}) {
  const { studyId } = await params
  const { live } = await searchParams

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

  const start = startSessionAction.bind(null, studyId, live === "1")

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary mb-1">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <h1 className="text-headline-small text-on-surface">
            {study.welcomeTitle || s.welcomeTitle}
          </h1>
          <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">
            {study.welcomeMessage || s.welcomeIntro}
          </p>
        </div>

        <form action={start}>
          <SubmitButton size="lg" className="h-12">
            {s.start}
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
