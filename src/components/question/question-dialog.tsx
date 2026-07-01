"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { M3TextField } from "@/components/ui/m3-text-field"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  X,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  AlignLeft,
  ListChecks,
  Star,
  ToggleRight,
} from "lucide-react"
import {
  createQuestionAction,
  updateQuestionAction,
} from "@/app/(dashboard)/studies/[id]/actions"

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

export function QuestionDialog({
  studyId,
  questionId,
  initial,
  variant,
}: {
  studyId: string
  questionId?: string
  initial?: QuestionInitial
  variant: "create" | "edit"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [type, setType] = useState<QType>(initial?.type ?? "open")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [required, setRequired] = useState(initial?.required ?? true)
  const [options, setOptions] = useState<string[]>(initial?.options?.length ? initial.options : ["", ""])

  const optionsValid = type !== "choice" || options.map((o) => o.trim()).filter(Boolean).length >= 2
  const canSave = title.trim().length > 0 && optionsValid && !pending

  function reset() {
    setType(initial?.type ?? "open")
    setTitle(initial?.title ?? "")
    setDescription(initial?.description ?? "")
    setRequired(initial?.required ?? true)
    setOptions(initial?.options?.length ? initial.options : ["", ""])
  }

  function save() {
    const input = {
      type,
      title: title.trim(),
      description: description.trim() || null,
      required,
      options: type === "choice" ? options.map((o) => o.trim()).filter(Boolean) : undefined,
    }
    startTransition(async () => {
      if (variant === "edit" && questionId) {
        await updateQuestionAction(studyId, questionId, input)
      } else {
        await createQuestionAction(studyId, input)
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) reset()
      }}
    >
      {variant === "create" ? (
        <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}>
          <Plus className="w-4 h-4 mr-2" />
          Nova pergunta
        </DialogTrigger>
      ) : (
        <DialogTrigger
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high cursor-pointer outline-none"
          aria-label="Editar pergunta"
        >
          <Pencil className="h-4 w-4" />
        </DialogTrigger>
      )}

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg rounded-[28px] p-0 gap-0 ring-0 border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      >
        <div className="p-8 max-h-[85vh] overflow-y-auto subtle-scroll">
          <div className="flex items-start justify-between mb-6">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-on-surface">
              {variant === "edit" ? "Editar pergunta" : "Nova pergunta"}
            </DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" />}>
              <X />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </div>

          <div className="space-y-6">
            {/* Tipo */}
            <div className="space-y-2.5">
              <p className="text-title-small text-on-surface-variant">Tipo</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

            {/* Enunciado */}
            <M3TextField
              label="Pergunta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              labelBg="bg-popover"
              autoFocus
            />

            {/* Descrição opcional */}
            <Textarea
              placeholder="Descrição / ajuda (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg min-h-20"
            />

            {/* Opções (só múltipla escolha) */}
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

            {/* Obrigatória */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-body-medium text-on-surface">Resposta obrigatória</span>
            </label>

            <Button onClick={save} disabled={!canSave} className="w-full h-12">
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {variant === "edit" ? "Salvar" : "Adicionar pergunta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
