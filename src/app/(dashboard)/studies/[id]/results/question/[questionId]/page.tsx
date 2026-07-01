import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function QuestionResultsPage({
  params,
}: {
  params: Promise<{ id: string; questionId: string }>
}) {
  const { id, questionId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      OR: [
        { block: { study: { id, ownerId: session.user.id } } },
        { mission: { block: { study: { id, ownerId: session.user.id } } } },
      ],
    },
    include: { answers: { orderBy: { createdAt: "desc" } } },
  })
  if (!question) notFound()

  const texts = question.answers
    .map((a) => a.text)
    .filter((t): t is string => !!t && t.trim().length > 0)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/studies/${id}/results`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-label-medium text-on-surface-variant">Respostas abertas</p>
          <h1 className="text-headline-small text-on-surface">{question.title}</h1>
        </div>
      </div>

      {texts.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          Ainda sem respostas.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-body-small text-on-surface-variant">{texts.length} resposta(s)</p>
          {texts.map((t, i) => (
            <div
              key={i}
              className="border border-outline-variant rounded-2xl p-5 bg-surface-container-low text-body-large text-on-surface whitespace-pre-wrap"
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
