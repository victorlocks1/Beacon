"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { M3TextField } from "@/components/ui/m3-text-field"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Loader2, Plus, Trash2, AlignLeft, ListChecks, Star, ToggleRight } from "lucide-react"
import { toast } from "@/components/ui/toast"
import {
  createQuestionAction,
  updateQuestionAction,
} from "@/app/(dashboard)/studies/[id]/actions"

function isRedirect(e: unknown) {
  const d = (e as { digest?: unknown })?.digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

type QType = "open" | "choice" | "rating" | "binary"

const TYPES: { value: QType; label: string; icon: React.ElementType }[] = [
  { value: "open", label: "Aberta", icon: AlignLeft },
  { value: "choice", label: "Múltipla escolha", icon: ListChecks },
  { value: "rating", label: "Estrelas", icon: Star },
  { value: "binary", label: "Sim / Não", icon: ToggleRight },
]

export interface QuestionInitial {
  type: QType
  title: string
  description: string | null
  required: boolean
  options: string[]
}

// Editor inline de pergunta (cria ou edita) — salva e permanece no builder.
export function QuestionEditor({
  studyId,
  editable,
  questionId,
  initial,
  onSaved,
}: {
  studyId: string
  editable: boolean
  questionId?: string // presente => edição
  initial?: QuestionInitial
  onSaved?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<QType>(initial?.type ?? "open")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [required, setRequired] = useState(initial?.required ?? true)
  const [options, setOptions] = useState<string[]>(
    initial?.options?.length ? initial.options : ["", ""]
  )

  const optionsValid = type !== "choice" || options.map((o) => o.trim()).filter(Boolean).length >= 2
  const canSave = editable && title.trim().length > 0 && optionsValid && !pending

  function save() {
    const input = {
      type,
      title: title.trim(),
      description: description.trim() || null,
      required,
      options: type === "choice" ? options.map((o) => o.trim()).filter(Boolean) : undefined,
    }
    startTransition(async () => {
      try {
        if (questionId) {
          await updateQuestionAction(studyId, questionId, input)
          toast.success("Pergunta atualizada")
        } else {
          await createQuestionAction(studyId, input)
          toast.success("Pergunta criada")
        }
        router.refresh()
        onSaved?.()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível salvar a pergunta.")
      }
    })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-title-medium text-on-surface">
        {questionId ? "Editar pergunta" : "Nova pergunta"}
      </h2>

      <fieldset disabled={!editable} className="space-y-6 disabled:opacity-60">
        {/* Tipo */}
        <div className="space-y-2.5">
          <p className="text-title-small text-on-surface-variant">Tipo</p>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map((t) => {
              const Icon = t.icon
              const active = type === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-colors",
                    active
                      ? "border-primary bg-primary/[0.04]"
                      : "border-outline-variant hover:border-on-surface-variant/50"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-on-surface-variant")} />
                  <span className="text-label-medium text-on-surface">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <M3TextField label="Pergunta" value={title} onChange={(e) => setTitle(e.target.value)} />

        <Textarea
          placeholder="Descrição / ajuda (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg min-h-20"
        />

        {type === "choice" && (
          <div className="space-y-2.5">
            <p className="text-title-small text-on-surface-variant">Opções</p>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`Opção ${i + 1}`}
                  className="h-11 flex-1 rounded-lg border border-outline bg-transparent px-3 text-base text-on-surface outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                  disabled={options.length <= 2}
                  className="text-on-surface-variant hover:text-error disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="text-body-small text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar opção
            </button>
          </div>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-body-medium text-on-surface">Resposta obrigatória</span>
        </label>

      </fieldset>

      {editable && (
        <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-surface border-t border-outline-variant flex justify-end">
          <Button onClick={save} disabled={!canSave}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {questionId ? "Salvar alterações" : "Adicionar pergunta"}
          </Button>
        </div>
      )}
    </div>
  )
}
