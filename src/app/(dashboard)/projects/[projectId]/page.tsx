import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { SubmitButton } from "@/components/submit-button"
import { Trash2, ArrowRight, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { CreateStudyDialog } from "@/components/study/create-study-dialog"
import { deleteStudyAction } from "@/app/(dashboard)/studies/actions"

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  live: "Ao vivo",
  closed: "Encerrado",
}
const statusVariant: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  live: "default",
  closed: "outline",
}

export default async function ProjectStudiesPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const project = await prisma.project.findUnique({
    where: { id: projectId, ownerId: session.user.id },
    include: {
      studies: {
        orderBy: { createdAt: "desc" },
        include: {
          prototype: { include: { _count: { select: { screens: true } } } },
          blocks: true,
        },
      },
    },
  })
  if (!project) notFound()

  const studies = project.studies

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/projects" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-body-small text-on-surface-variant">Projetos</span>
      </div>

      <div className="flex items-center justify-between mb-10">
        <h1 className="text-headline-large text-on-surface">{project.name}</h1>
        <CreateStudyDialog projectId={project.id} />
      </div>

      {studies.length === 0 ? (
        <div className="text-center py-24 border border-outline-variant rounded-3xl bg-surface-container-low">
          <p className="text-title-medium text-on-surface">Nenhum study ainda</p>
          <p className="text-body-medium text-on-surface-variant mt-1.5">
            Clique em &quot;Novo study&quot; para começar
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {studies.map((study) => (
            <div
              key={study.id}
              className="rounded-3xl bg-surface-container-low border border-outline-variant p-6 flex flex-col gap-4 transition-shadow hover:elevation-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-title-large text-on-surface truncate">{study.title}</h2>
                  <p className="text-body-small text-on-surface-variant mt-1">
                    {study.prototype?._count.screens ?? 0} tela(s) · {study.blocks.length} bloco(s)
                  </p>
                </div>
                <Badge variant={statusVariant[study.status]}>{statusLabel[study.status]}</Badge>
              </div>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-outline-variant">
                <form action={deleteStudyAction.bind(null, study.id)}>
                  <SubmitButton
                    variant="ghost"
                    size="icon-sm"
                    fullWidth={false}
                    className="text-on-surface-variant hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </SubmitButton>
                </form>
                <Link
                  href={`/studies/${study.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
                >
                  Abrir <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
