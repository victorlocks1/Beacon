import { prisma } from "@/lib/db"
import { startSessionAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ClipboardCheck, MousePointerClick, Clock } from "lucide-react"

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

  if (!study || study.status !== "live") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center">
            <h1 className="text-lg font-semibold">Teste indisponível</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Este teste não está aberto no momento. Verifique o link com quem
              te convidou.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const missionCount = study.blocks.length
  const start = startSessionAction.bind(null, studyId)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardContent className="py-8 px-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-1">
              <ClipboardCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Teste de usabilidade</h1>
            <p className="text-sm text-muted-foreground">
              Você foi convidado(a) para um teste rápido e anônimo. Não há
              respostas certas ou erradas — queremos entender como você usa a
              interface.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <MousePointerClick className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>
                Você verá {missionCount === 1 ? "uma tarefa" : `${missionCount} tarefas`} e
                deverá clicar pela interface para realizá-{missionCount === 1 ? "la" : "las"}.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>Leva poucos minutos. Seus cliques são registrados de forma anônima.</span>
            </div>
          </div>

          <form action={start}>
            <Button type="submit" className="w-full" size="lg">
              Começar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
