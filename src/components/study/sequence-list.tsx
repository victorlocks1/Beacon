"use client"
import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { GripVertical, Pencil, Trash2, Target, Route } from "lucide-react"
import { cn } from "@/lib/utils"
import { QuestionDialog } from "@/components/question/question-dialog"
import { toast } from "@/components/ui/toast"
import {
  deleteMissionAction,
  deleteQuestionAction,
  deleteSusBlockAction,
  reorderBlocksAction,
} from "@/app/(dashboard)/studies/[id]/actions"
import { ClipboardCheck } from "lucide-react"

// Deixa o NEXT_REDIRECT (ex.: bloqueio de estudo ao vivo) propagar sem virar toast de erro.
function isRedirect(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}

const qTypeLabel: Record<string, string> = {
  open: "Pergunta aberta",
  choice: "Múltipla escolha",
  rating: "Avaliação por estrelas",
  binary: "Sim / Não",
}

export type SeqBlock =
  | {
      id: string
      kind: "mission"
      missionId: string
      task: string
      description: string | null
      startScreenName: string
      successType: "screen" | "path"
      goalScreenName: string | null
      pathsCount: number
    }
  | {
      id: string
      kind: "question"
      questionId: string
      qtype: "open" | "choice" | "rating" | "binary"
      title: string
      description: string | null
      required: boolean
      options: string[]
    }
  | {
      id: string
      kind: "sus"
    }

export function SequenceList({
  studyId,
  editable,
  blocks,
}: {
  studyId: string
  editable: boolean
  blocks: SeqBlock[]
}) {
  const [items, setItems] = useState(blocks)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDeleteMission(missionId: string) {
    startTransition(async () => {
      try {
        await deleteMissionAction(studyId, missionId)
        toast.success("Missão excluída")
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível excluir.")
      }
    })
  }

  function handleDeleteQuestion(questionId: string) {
    startTransition(async () => {
      try {
        await deleteQuestionAction(studyId, questionId)
        toast.success("Pergunta excluída")
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível excluir.")
      }
    })
  }

  function handleDeleteSus(blockId: string) {
    startTransition(async () => {
      try {
        await deleteSusBlockAction(studyId, blockId)
        toast.success("SUS removido")
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível excluir.")
      }
    })
  }

  // Ressincroniza quando o conjunto/ordem muda no servidor (add/remove/reorder)
  const signature = blocks.map((b) => b.id).join(",")
  const lastSignature = useRef(signature)
  useEffect(() => {
    if (lastSignature.current !== signature) {
      lastSignature.current = signature
      setItems(blocks)
    }
  }, [signature, blocks])

  function onDragOver(e: React.DragEvent, overId: string) {
    if (!draggingId) return
    e.preventDefault()
    if (draggingId === overId) return
    setItems((prev) => {
      const from = prev.findIndex((b) => b.id === draggingId)
      const to = prev.findIndex((b) => b.id === overId)
      if (from === -1 || to === -1 || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function persist() {
    const ordered = items.map((b) => b.id)
    // Só grava se a ordem mudou de fato
    if (ordered.join(",") !== signature) {
      startTransition(() => reorderBlocksAction(studyId, ordered))
    }
  }

  return (
    <div className="space-y-3">
      {items.map((block, index) => {
        const dragProps = editable
          ? {
              draggable: true,
              onDragStart: (e: React.DragEvent) => {
                setDraggingId(block.id)
                e.dataTransfer.effectAllowed = "move"
              },
              onDragOver: (e: React.DragEvent) => onDragOver(e, block.id),
              onDrop: (e: React.DragEvent) => e.preventDefault(),
              onDragEnd: () => {
                setDraggingId(null)
                persist()
              },
            }
          : {}

        const handle = editable && (
          <div className="shrink-0 flex items-center text-on-surface-variant/60 cursor-grab active:cursor-grabbing pt-0.5">
            <GripVertical className="h-5 w-5" />
          </div>
        )

        return (
          <div
            key={block.id}
            {...dragProps}
            className={cn(
              "border border-outline-variant rounded-2xl p-5 bg-surface-container-low transition-shadow",
              editable && "select-none",
              draggingId === block.id && "opacity-50 ring-2 ring-primary"
            )}
          >
            {block.kind === "mission" ? (
              <>
                <div className="flex items-start gap-3">
                  {handle}
                  <div className="min-w-0 flex-1">
                    <p className="text-label-medium text-on-surface-variant mb-1">
                      PASSO {index + 1} · TAREFA
                    </p>
                    <h3 className="text-title-medium text-on-surface">{block.task}</h3>
                    {block.description && (
                      <p className="text-sm text-muted-foreground mt-1">{block.description}</p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/studies/${studyId}/missions/${block.missionId}/edit`}
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        title="Editar missão"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => handleDeleteMission(block.missionId)}
                        className="text-muted-foreground hover:text-red-500"
                        title="Excluir missão"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <Separator className="my-3" />
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span>
                    Início: <span className="text-foreground font-medium">{block.startScreenName}</span>
                  </span>
                  {block.successType === "screen" ? (
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Tela-alvo: <span className="text-foreground font-medium">{block.goalScreenName ?? "—"}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Route className="h-3 w-3" />
                      Caminho exato: <span className="text-foreground font-medium">{block.pathsCount} caminho(s)</span>
                    </span>
                  )}
                </div>
              </>
            ) : block.kind === "sus" ? (
              <div className="flex items-start gap-3">
                {handle}
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-label-medium text-on-surface-variant mb-1">
                    PASSO {index + 1} · SUS
                  </p>
                  <h3 className="text-title-medium text-on-surface">Questionário SUS</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    10 afirmações padrão (escala 1–5), não editáveis. Vira uma nota de 0 a 100.
                  </p>
                </div>
                {editable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => handleDeleteSus(block.id)}
                    className="text-muted-foreground hover:text-red-500 shrink-0"
                    title="Remover SUS"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3">
                {handle}
                <div className="min-w-0 flex-1">
                  <p className="text-label-medium text-on-surface-variant mb-1">
                    PASSO {index + 1} · PERGUNTA
                  </p>
                  <h3 className="text-title-medium text-on-surface">{block.title}</h3>
                  {block.description && (
                    <p className="text-sm text-muted-foreground mt-1">{block.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{qTypeLabel[block.qtype]}</Badge>
                    {block.qtype === "choice" && (
                      <span className="text-xs text-muted-foreground">{block.options.length} opções</span>
                    )}
                    {!block.required && <span className="text-xs text-muted-foreground">opcional</span>}
                  </div>
                </div>
                {editable && (
                  <div className="flex items-center gap-1 shrink-0">
                    <QuestionDialog
                      studyId={studyId}
                      questionId={block.questionId}
                      variant="edit"
                      initial={{
                        type: block.qtype,
                        title: block.title,
                        description: block.description,
                        required: block.required,
                        options: block.options,
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => handleDeleteQuestion(block.questionId)}
                      className="text-muted-foreground hover:text-red-500"
                      title="Excluir pergunta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
