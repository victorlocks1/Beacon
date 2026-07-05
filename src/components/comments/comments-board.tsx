"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toast"
import { Check, CornerDownRight, Loader2, MessageSquarePlus, Trash2, X } from "lucide-react"
import {
  addCommentAction,
  replyCommentAction,
  resolveCommentAction,
  deleteCommentAction,
} from "@/app/(dashboard)/studies/[id]/review/actions"

export type BoardScreen = { id: string; name: string; imageUrl: string }
export type BoardTask = {
  id: string
  label: string // "Tarefa 1"
  task: string
  description: string | null
  screenIds: string[] // telas âncora da tarefa (inicial + objetivo)
}
export type BoardReply = { id: string; body: string; authorName: string; authorId: string }
export type BoardComment = {
  id: string
  screenId: string
  xNorm: number
  yNorm: number
  body: string
  resolved: boolean
  authorName: string
  authorId: string
  replies: BoardReply[]
}

type Selection =
  | { kind: "new"; screenId: string; x: number; y: number }
  | { kind: "thread"; commentId: string }
  | null

export function CommentsBoard({
  studyId,
  screens,
  tasks = [],
  comments,
  currentUserId,
  isOwner,
}: {
  studyId: string
  screens: BoardScreen[]
  tasks?: BoardTask[]
  comments: BoardComment[]
  currentUserId: string
  isOwner: boolean
}) {
  const router = useRouter()
  const [selection, setSelection] = useState<Selection>(null)
  const [draft, setDraft] = useState("")
  const [reply, setReply] = useState("")
  const [pending, startTransition] = useTransition()

  const active =
    selection?.kind === "thread" ? comments.find((c) => c.id === selection.commentId) ?? null : null

  function screenClick(e: React.MouseEvent<HTMLDivElement>, screenId: string) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    setDraft("")
    setSelection({ kind: "new", screenId, x, y })
  }

  function submitNew() {
    if (selection?.kind !== "new" || !draft.trim()) return
    const { screenId, x, y } = selection
    startTransition(async () => {
      try {
        await addCommentAction(studyId, { screenId, xNorm: x, yNorm: y, body: draft })
        setDraft("")
        setSelection(null)
        router.refresh()
        toast.success("Comentário adicionado")
      } catch {
        toast.error("Não foi possível concluir. Tente novamente.")
      }
    })
  }

  function submitReply() {
    if (!active || !reply.trim()) return
    startTransition(async () => {
      try {
        await replyCommentAction(studyId, active.id, reply)
        setReply("")
        router.refresh()
        toast.success("Resposta enviada")
      } catch {
        toast.error("Não foi possível concluir. Tente novamente.")
      }
    })
  }

  function toggleResolve(c: BoardComment) {
    startTransition(async () => {
      try {
        await resolveCommentAction(studyId, c.id, !c.resolved)
        router.refresh()
        toast.success(!c.resolved ? "Comentário resolvido" : "Comentário reaberto")
      } catch {
        toast.error("Não foi possível concluir. Tente novamente.")
      }
    })
  }

  function remove(commentId: string) {
    startTransition(async () => {
      try {
        await deleteCommentAction(studyId, commentId)
        if (selection?.kind === "thread" && selection.commentId === commentId) setSelection(null)
        router.refresh()
        toast.success("Comentário excluído")
      } catch {
        toast.error("Não foi possível concluir. Tente novamente.")
      }
    })
  }

  const commentsByScreen = (id: string) => comments.filter((c) => c.screenId === id)
  const screenById = new Map(screens.map((s) => [s.id, s]))

  // Uma tela com seus pins de comentário (bloco reutilizável).
  function ScreenPins({ s }: { s: BoardScreen }) {
    const cs = commentsByScreen(s.id)
    return (
      <div className="space-y-2">
        <p className="text-title-small text-on-surface">{s.name}</p>
        <div
          className="relative w-full max-w-[360px] rounded-xl overflow-hidden border border-outline-variant cursor-crosshair"
          onClick={(e) => screenClick(e, s.id)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.imageUrl} alt={s.name} className="w-full block select-none" draggable={false} />
          {cs.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelection({ kind: "thread", commentId: c.id })
              }}
              style={{ left: `${c.xNorm * 100}%`, top: `${c.yNorm * 100}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full rounded-bl-none border-2 border-white text-xs font-semibold flex items-center justify-center shadow",
                c.resolved ? "bg-emerald-600 text-white" : "bg-primary text-on-primary",
                selection?.kind === "thread" && selection.commentId === c.id && "ring-2 ring-primary ring-offset-1"
              )}
              title={c.body}
            >
              {i + 1}
            </button>
          ))}
          {selection?.kind === "new" && selection.screenId === s.id && (
            <span
              style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full rounded-bl-none border-2 border-white bg-amber-500 shadow animate-pulse"
            />
          )}
        </div>
      </div>
    )
  }

  // Telas âncora já cobertas pelas tarefas → o resto vai para "Outras telas".
  const taskedIds = new Set(tasks.flatMap((t) => t.screenIds))
  const otherScreens = screens.filter((s) => !taskedIds.has(s.id))

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      {/* Fluxo por tarefa + pins */}
      <div className="space-y-10">
        <p className="text-body-small text-on-surface-variant">
          Revise cada tarefa no seu contexto. Clique em qualquer ponto de uma tela para comentar.
        </p>

        {tasks.map((t) => {
          const taskScreens = t.screenIds
            .map((id) => screenById.get(id))
            .filter((s): s is BoardScreen => !!s)
          return (
            <section key={t.id} className="space-y-4">
              <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                <p className="text-label-medium text-on-surface-variant">{t.label}</p>
                <h3 className="text-title-medium text-on-surface mt-0.5">{t.task}</h3>
                {t.description && (
                  <p className="text-body-medium text-on-surface-variant mt-1">{t.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-6">
                {taskScreens.map((s) => (
                  <ScreenPins key={s.id} s={s} />
                ))}
              </div>
            </section>
          )
        })}

        {otherScreens.length > 0 && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
              <p className="text-label-medium text-on-surface-variant">
                {tasks.length > 0 ? "Outras telas do protótipo" : "Telas"}
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
              {otherScreens.map((s) => (
                <ScreenPins key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Painel: novo comentário OU thread selecionada */}
      <div className="lg:sticky lg:top-6 rounded-2xl border border-outline-variant bg-surface-container-low p-5 min-h-40">
        {selection?.kind === "new" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-title-small text-on-surface flex items-center gap-1.5">
                <MessageSquarePlus className="h-4 w-4" /> Novo comentário
              </p>
              <button onClick={() => setSelection(null)} className="text-on-surface-variant hover:text-on-surface">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Descreva o ajuste ou observação…"
              className="rounded-lg min-h-24"
              autoFocus
            />
            <Button onClick={submitNew} disabled={pending || !draft.trim()} className="w-full">
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Comentar
            </Button>
          </div>
        ) : active ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-title-small text-on-surface">{active.authorName}</p>
                {active.resolved && <p className="text-body-small text-emerald-700">Resolvido</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleResolve(active)}
                  disabled={pending}
                  title={active.resolved ? "Reabrir" : "Marcar como resolvido"}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high",
                    active.resolved ? "text-emerald-700" : "text-on-surface-variant"
                  )}
                >
                  <Check className="h-4 w-4" />
                </button>
                {(active.authorId === currentUserId || isOwner) && (
                  <button
                    onClick={() => remove(active.id)}
                    disabled={pending}
                    title="Excluir"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelection(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="text-body-medium text-on-surface whitespace-pre-wrap">{active.body}</p>

            {active.replies.length > 0 && (
              <div className="space-y-3 border-l-2 border-outline-variant pl-3">
                {active.replies.map((r) => (
                  <div key={r.id} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-label-medium text-on-surface-variant">{r.authorName}</p>
                      {(r.authorId === currentUserId || isOwner) && (
                        <button
                          onClick={() => remove(r.id)}
                          disabled={pending}
                          className="text-on-surface-variant/70 hover:text-error"
                          title="Excluir resposta"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-body-medium text-on-surface whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 pt-1">
              <CornerDownRight className="h-4 w-4 text-on-surface-variant mb-2.5 shrink-0" />
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder…"
                className="rounded-lg min-h-11 flex-1"
              />
              <Button size="sm" onClick={submitReply} disabled={pending || !reply.trim()} className="mb-0.5">
                Enviar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-body-medium text-on-surface-variant text-center py-8">
            Clique numa tela para comentar, ou num pino para ver a conversa.
          </p>
        )}
      </div>
    </div>
  )
}
