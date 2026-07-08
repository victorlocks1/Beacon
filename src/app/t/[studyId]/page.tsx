import { prisma } from "@/lib/db"
import { startSessionAction } from "./actions"
import { SubmitButton } from "@/components/submit-button"
import { ClipboardCheck, Info } from "lucide-react"
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
  const howItWorks = study.howItWorks?.trim()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div
        className={
          "w-full rounded-[28px] bg-surface-container-low border border-outline-variant p-8 md:p-10 " +
          (howItWorks
            ? "max-w-3xl grid md:grid-cols-2 gap-8 md:gap-10 items-start"
            : "max-w-md")
        }
      >
        {/* Boas-vindas (alinhado à esquerda) */}
        <div className="space-y-6 text-left">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <div className="space-y-3">
            <h1 className="text-headline-small text-on-surface">
              {study.welcomeTitle || s.welcomeTitle}
            </h1>
            <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">
              {study.welcomeMessage || s.welcomeIntro}
            </p>
          </div>
        </div>

        {/* Como funciona (à direita, separado) */}
        {howItWorks && (
          <div className="space-y-3 text-left md:border-l md:border-outline-variant md:pl-10">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Info className="h-5 w-5" />
            </div>
            <h2 className="text-title-large text-on-surface">{s.howItWorksTitle}</h2>
            <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">{howItWorks}</p>
          </div>
        )}

        {/* Botão no rodapé direito do card (abaixo das duas colunas) */}
        <form action={start} className={"flex justify-end " + (howItWorks ? "md:col-span-2" : "mt-8")}>
          <SubmitButton size="lg" fullWidth={false} className="h-12 px-8">
            {s.start}
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
