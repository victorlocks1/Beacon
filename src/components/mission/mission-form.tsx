"use client"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PathRecorder } from "@/components/mission/path-recorder"
import { createMissionAction } from "@/app/(dashboard)/studies/[id]/actions"
import { cn } from "@/lib/utils"
import { Target, Route, Loader2 } from "lucide-react"

type DeviceType = "desktop" | "tablet" | "mobile"
type SuccessType = "screen" | "path"

interface Hotspot {
  id: string
  coords: { x: number; y: number; w: number; h: number }
  targetScreenId: string
}
interface Screen {
  id: string
  name: string
  order: number
  imageUrl: string
  hotspots: Hotspot[]
}

interface Props {
  studyId: string
  deviceType: DeviceType
  screens: Screen[]
}

export function MissionForm({ studyId, deviceType, screens }: Props) {
  const [task, setTask] = useState("")
  const [description, setDescription] = useState("")
  const [successType, setSuccessType] = useState<SuccessType>("screen")
  const [startScreenId, setStartScreenId] = useState<string>("")
  const [goalScreenId, setGoalScreenId] = useState<string>("")
  const [paths, setPaths] = useState<string[][]>([])
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const screenItems = Object.fromEntries(
    screens.map((s) => [s.id, `Tela ${s.order + 1}: ${s.name}`])
  )

  function submit() {
    setErr(null)
    if (!task.trim()) return setErr("Informe a tarefa.")
    if (!startScreenId) return setErr("Selecione a tela inicial.")
    if (successType === "screen" && !goalScreenId)
      return setErr("Selecione a tela de sucesso.")
    if (successType === "path" && paths.length === 0)
      return setErr("Grave ao menos um caminho esperado.")

    startTransition(() =>
      createMissionAction(studyId, {
        task,
        description,
        startScreenId,
        successType,
        goalScreenId: successType === "screen" ? goalScreenId : null,
        paths: successType === "path" ? paths : undefined,
      })
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="task">Tarefa *</Label>
        <Input
          id="task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Ex: Adicione um item ao carrinho"
        />
        <p className="text-xs text-muted-foreground">
          Descreva o objetivo sem dar dicas sobre onde clicar.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Cenário (opcional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Você quer comprar um tênis azul. Como faria isso neste app?"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Tela inicial *</Label>
        <Select
          value={startScreenId}
          onValueChange={(v) => setStartScreenId((v as string) ?? "")}
          items={screenItems}
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

      {/* Critério de sucesso */}
      <div className="space-y-2">
        <Label>Critério de sucesso *</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSuccessType("screen")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors",
              successType === "screen"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/40"
            )}
          >
            <Target
              className={cn(
                "h-5 w-5",
                successType === "screen" ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className="text-sm font-medium">Tela-alvo</span>
            <span className="text-xs text-muted-foreground">
              Sucesso ao chegar numa tela, por qualquer caminho.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSuccessType("path")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors",
              successType === "path"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/40"
            )}
          >
            <Route
              className={cn(
                "h-5 w-5",
                successType === "path" ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className="text-sm font-medium">Caminho exato</span>
            <span className="text-xs text-muted-foreground">
              Grava o caminho esperado; classifica direto/indireto.
            </span>
          </button>
        </div>
      </div>

      {/* Configuração por tipo */}
      {successType === "screen" ? (
        <div className="space-y-2">
          <Label>Tela de sucesso *</Label>
          <Select
            value={goalScreenId}
            onValueChange={(v) => setGoalScreenId((v as string) ?? "")}
            items={screenItems}
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
      ) : (
        <div className="space-y-2">
          <Label>Caminho(s) esperado(s) *</Label>
          <PathRecorder
            screens={screens}
            startScreenId={startScreenId || null}
            deviceType={deviceType}
            paths={paths}
            onChange={setPaths}
          />
        </div>
      )}

      {err && <p className="text-sm text-red-500">{err}</p>}

      <Button onClick={submit} disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Criar missão
      </Button>
    </div>
  )
}
