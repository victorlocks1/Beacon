import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CreateStudyDialog } from "@/components/study/create-study-dialog"
import { deleteStudyAction } from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Trash2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

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

export default async function StudiesPage() {
  const session = await auth()

  const studies = await prisma.study.findMany({
    where: { ownerId: session!.user.id },
    include: {
      prototype: { include: { _count: { select: { screens: true } } } },
      blocks: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Meus Studies</h1>
        <CreateStudyDialog />
      </div>

      {studies.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <p className="text-lg font-medium">Nenhum study ainda</p>
          <p className="text-sm mt-1">Clique em "Novo study" para começar</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studies.map((study) => (
            <div
              key={study.id}
              className="border rounded-xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold truncate">{study.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {study.prototype?._count.screens ?? 0} tela(s) ·{" "}
                    {study.blocks.length} missão(ões)
                  </p>
                </div>
                <Badge variant={statusVariant[study.status]}>
                  {statusLabel[study.status]}
                </Badge>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t">
                <Link
                  href={`/studies/${study.id}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "gap-1"
                  )}
                >
                  Abrir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <form action={deleteStudyAction.bind(null, study.id)}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    type="submit"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
