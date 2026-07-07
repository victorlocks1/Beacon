"use client"
import { useRef, useState, useTransition } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { M3TextField } from "@/components/ui/m3-text-field"
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
import { FigmaPathRecorder } from "@/components/mission/figma-path-recorder"
import { FIGMA_EMBED_CLIENT_ID } from "@/lib/figma-embed"
import { QuestionDialog, type QuestionInput } from "@/components/question/question-dialog"
import { createMissionAction, updateMissionAction } from "@/app/(dashboard)/studies/[id]/actions"
import { cn } from "@/lib/utils"
import { Target, Route, Loader2, Plus, Pencil, Trash2 } from "lucide-react"

const qTypeLabel: Record<string, string> = {
  open: "Aberta",
  choice: "Múltipla escolha",
  rating: "Estrelas",
  binary: "Sim / Não",
}
type LocalQuestion = QuestionInput & { key: string }

type DeviceType = "desktop" | "tablet" | "mobile"
type SuccessType = "screen" | "path"

interface Hotspot {
  id: string
  coords: { x: number; y: number; w: number; h: number }
  action: "navigate" | "open_overlay" | "close_overlay" | "back"
  overlayPosition: "bottom" | "center" | null
  targetScreenId: string | null
}
interface Screen {
  id: string
  name: string
  order: number
  imageUrl: string
  width: number
  height: number
  scroll: "none" | "vertical" | "horizontal" | "both"
  figmaNodeId?: string | null
  hotspots: Hotspot[]
  scrollRegions?: {
    id: string
    kind: "scroll" | "fixed"
    coords: { x: number; y: number; w: number; h: number }
    axis: "horizontal" | "vertical" | "both"
    imageUrl: string | null
  }[]
}

export interface MissionInitial {
  task: string
  description: string | null
  successType: SuccessType
  startScreenId: string
  goalScreenId: string | null
  paths: string[][]
  questions?: QuestionInput[]
}

interface Props {
  studyId: string
  deviceType: DeviceType
  screens: Screen[]
  figmaFileKey?: string | null // presente => protótipo vivo do Figma (grava caminho no embed)
  missionId?: string // presente => modo edição
  initial?: MissionInitial
}

export function MissionForm({ studyId, deviceType, screens, figmaFileKey, missionId, initial }: Props) {
  // Estudos do Figma gravam o caminho no protótipo vivo (embed); manuais usam o player de imagem.
  const canEmbed = !!figmaFileKey && !!FIGMA_EMBED_CLIENT_ID
  const isEdit = !!missionId
  const [task, setTask] = useState(initial?.task ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [successType, setSuccessType] = useState<SuccessType>(initial?.successType ?? "screen")
  const [startScreenId, setStartScreenId] = useState<string>(initial?.startScreenId ?? "")
  const [goalScreenId, setGoalScreenId] = useState<string>(initial?.goalScreenId ?? "")
  const [paths, setPaths] = useState<string[][]>(initial?.paths ?? [])
  const keyRef = useRef(0)
  const [questions, setQuestions] = useState<LocalQuestion[]>(
    (initial?.questions ?? []).map((q) => ({ ...q, key: `q${keyRef.current++}` }))
  )
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function addQuestion(input: QuestionInput) {
    setQuestions((prev) => [...prev, { ...input, key: `q${keyRef.current++}` }])
  }
  function updateQuestion(key: string, input: QuestionInput) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...input, key } : q)))
  }
  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key))
  }

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

    const payload = {
      task,
      description,
      startScreenId,
      successType,
      goalScreenId: successType === "screen" ? goalScreenId : null,
      paths: successType === "path" ? paths : undefined,
      questions: questions
        .filter((q) => q.title.trim())
        .map(({ key: _key, ...q }) => q),
    }

    startTransition(() =>
      isEdit
        ? updateMissionAction(studyId, missionId!, payload)
        : createMissionAction(studyId, payload)
    )
  }

  return (
    <div className="space-y-10">
      {/* ── Sobre a tarefa ── */}
      <section className="space-y-5">
        <div>
          <h2 className="text-title-medium text-on-surface">A tarefa</h2>
          <p className="text-body-small text-on-surface-variant mt-0.5">
            O que o testador deve realizar — sem dizer onde clicar.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-title-small text-on-surface">
            Cenário <span className="text-on-surface-variant font-normal">(opcional)</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Você quer comprar um tênis azul. Como faria isso neste app?"
            rows={3}
            className="rounded-lg border-outline bg-transparent text-base focus-visible:border-primary min-h-28"
          />
          <p className="text-body-small text-on-surface-variant px-1">
            O contexto que aparece antes da tarefa.
          </p>
        </div>

        <div className="space-y-1.5">
          <M3TextField
            label="Tarefa"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            required
          />
          <p className="text-body-small text-on-surface-variant px-1">
            Ex.: “Adicione um item ao carrinho”.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-title-small text-on-surface">Tela inicial</Label>
          <Select
            value={startScreenId}
            onValueChange={(v) => setStartScreenId((v as string) ?? "")}
            items={screenItems}
          >
            <SelectTrigger className="w-full h-14 rounded-lg">
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
      </section>

      {/* ── Critério de sucesso ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-title-medium text-on-surface">Critério de sucesso</h2>
          <p className="text-body-small text-on-surface-variant mt-0.5">
            Como saber que o testador concluiu a tarefa.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {([
            { key: "screen" as const, icon: Target, title: "Tela-alvo", desc: "Sucesso ao chegar numa tela, por qualquer caminho." },
            { key: "path" as const, icon: Route, title: "Caminho exato", desc: "Grava o caminho esperado; classifica direto/indireto." },
          ]).map((opt) => {
            const Icon = opt.icon
            const active = successType === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSuccessType(opt.key)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-2xl border-2 p-5 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/[0.04]"
                    : "border-outline-variant hover:border-on-surface-variant/50"
                )}
              >
                <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-on-surface-variant")} />
                <span className="text-title-small text-on-surface">{opt.title}</span>
                <span className="text-body-small text-on-surface-variant">{opt.desc}</span>
              </button>
            )
          })}
        </div>

        {successType === "screen" ? (
          <div className="space-y-2 pt-1">
            <Label className="text-title-small text-on-surface">Tela de sucesso</Label>
            <Select
              value={goalScreenId}
              onValueChange={(v) => setGoalScreenId((v as string) ?? "")}
              items={screenItems}
            >
              <SelectTrigger className="w-full h-14 rounded-lg">
                <SelectValue placeholder="Selecione a tela que conta como sucesso" />
              </SelectTrigger>
              <SelectContent side="top">
                {screens.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Tela {s.order + 1}: {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <Label className="text-title-small text-on-surface">Caminho(s) esperado(s)</Label>
            {canEmbed ? (
              <FigmaPathRecorder
                fileKey={figmaFileKey!}
                screens={screens.map((s) => ({
                  id: s.id,
                  name: s.name,
                  order: s.order,
                  figmaNodeId: s.figmaNodeId ?? null,
                }))}
                startScreenId={startScreenId || null}
                paths={paths}
                onChange={setPaths}
              />
            ) : (
              <PathRecorder
                screens={screens}
                startScreenId={startScreenId || null}
                deviceType={deviceType}
                paths={paths}
                onChange={setPaths}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Perguntas de acompanhamento ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-title-medium text-on-surface">Perguntas de acompanhamento</h2>
          <p className="text-body-small text-on-surface-variant mt-0.5">
            Perguntas que o testador responde logo após concluir esta tarefa (opcional).
          </p>
        </div>

        {questions.length > 0 && (
          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.key}
                className="flex items-center gap-2 rounded-2xl border border-outline-variant p-3 bg-surface-container-low"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-medium text-on-surface truncate">{q.title || "—"}</p>
                  <p className="text-label-small text-on-surface-variant">
                    {qTypeLabel[q.type]}
                    {!q.required ? " · opcional" : ""}
                  </p>
                </div>
                <QuestionDialog
                  variant="edit"
                  initial={{
                    type: q.type,
                    title: q.title,
                    description: q.description,
                    required: q.required,
                    options: q.options ?? [],
                  }}
                  onSubmit={(input) => updateQuestion(q.key, input)}
                  trigger={
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high">
                      <Pencil className="h-4 w-4" />
                    </span>
                  }
                />
                <button
                  type="button"
                  onClick={() => removeQuestion(q.key)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:text-error"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <QuestionDialog
          variant="create"
          onSubmit={addQuestion}
          trigger={
            <span className={cn(buttonVariants({ variant: "outline" }))}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar pergunta
            </span>
          }
        />
      </section>

      {err && (
        <p className="text-body-small text-error px-1">{err}</p>
      )}

      <Button onClick={submit} disabled={pending} className="w-full h-12">
        {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {isEdit ? "Salvar alterações" : "Criar missão"}
      </Button>
    </div>
  )
}
