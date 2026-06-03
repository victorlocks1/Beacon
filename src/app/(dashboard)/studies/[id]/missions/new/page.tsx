import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"
import { SubmitButton } from "@/components/submit-button"
import { createMissionAction } from "../../actions"

export default async function NewMissionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studyId } = await params
  const session = await auth()
  if (!session) redirect("/login")

  const study = await prisma.study.findUnique({
    where: { id: studyId, ownerId: session.user.id },
    include: {
      prototype: { include: { screens: { orderBy: { order: "asc" } } } },
    },
  })

  if (!study) notFound()
  const screens = study.prototype?.screens ?? []

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/studies/${studyId}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Nova missão</h1>
      </div>

      <form
        action={createMissionAction.bind(null, studyId)}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="task">Tarefa *</Label>
          <Input
            id="task"
            name="task"
            placeholder="Ex: Adicione um item ao carrinho"
            required
          />
          <p className="text-xs text-muted-foreground">
            Descreva o objetivo sem dar dicas sobre onde clicar.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Cenário (opcional)</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Ex: Você quer comprar um tênis azul. Como faria isso neste app?"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Tela inicial *</Label>
          <Select
            name="startScreenId"
            required
            items={Object.fromEntries(screens.map((s) => [s.id, `Tela ${s.order + 1}: ${s.name}`]))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a tela de início" />
            </SelectTrigger>
            <SelectContent>
              {screens.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Tela {s.order + 1}: {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tela de sucesso *</Label>
          <Select
            name="goalScreenId"
            required
            items={Object.fromEntries(screens.map((s) => [s.id, `Tela ${s.order + 1}: ${s.name}`]))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a tela que conta como sucesso" />
            </SelectTrigger>
            <SelectContent>
              {screens.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Tela {s.order + 1}: {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SubmitButton>Criar missão</SubmitButton>
      </form>
    </div>
  )
}
