import { prisma } from "@/lib/db"
import { startSessionAction } from "./actions"
import { SubmitButton } from "@/components/submit-button"
import { TesterEntryCard } from "@/components/test/tester-entry-card"
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

  // Aceita o id do estudo OU o código curto (URL encurtada: /t/<testerCode>).
  const study = await prisma.study.findFirst({
    where: { OR: [{ id: studyId }, { testerCode: studyId }] },
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

  const start = startSessionAction.bind(null, study.id, live === "1")
  return (
    <TesterEntryCard
      lang={(study.language ?? "pt") as Lang}
      welcomeTitle={study.welcomeTitle}
      welcomeMessage={study.welcomeMessage}
      howItWorks={study.howItWorks}
      startButton={
        <form action={start}>
          <SubmitButton size="lg" fullWidth={false} className="h-12 px-8">
            {s.start}
          </SubmitButton>
        </form>
      }
    />
  )
}
