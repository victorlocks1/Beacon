"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Loader2, AlertTriangle } from "lucide-react"
import { toast } from "@/components/ui/toast"
import {
  deleteScreensAction,
  screenDeletionImpactAction,
  type ScreenDeletionImpact,
} from "@/app/(dashboard)/studies/[id]/actions"

// Confirmação para excluir telas — a mesma para uma tela, as selecionadas ou
// todas. A exclusão é livre, mas antes mostra o que acontece com cada tarefa
// ligada a essas telas (tarefa excluída, sem critério de sucesso, etc.).
export function ScreenDeleteDialog({
  studyId,
  screenIds,
  label,
  open,
  onOpenChange,
  onDeleted,
}: {
  studyId: string
  screenIds: string[]
  label: string // ex.: "a tela Home", "3 telas", "todas as 28 telas"
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const router = useRouter()
  // impacto calculado para UMA seleção (key); outra seleção = ainda carregando
  const [result, setResult] = useState<{ key: string; impacts: ScreenDeletionImpact[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const key = screenIds.join(",")
  const impacts = result?.key === key ? result.impacts : null

  useEffect(() => {
    if (!open) return
    let alive = true
    screenDeletionImpactAction(studyId, key ? key.split(",") : [])
      .then((r) => alive && setResult({ key, impacts: r }))
      .catch(() => alive && setResult({ key, impacts: [] }))
    return () => {
      alive = false
    }
  }, [open, studyId, key])

  async function confirm() {
    setBusy(true)
    try {
      const res = await deleteScreensAction(studyId, screenIds)
      onOpenChange(false)
      toast.success(`${res.deleted} tela(s) excluída(s)`)
      onDeleted?.()
      router.refresh()
    } catch {
      toast.error("Não foi possível excluir as telas.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Remove do protótipo, com os hotspots e regiões, e os hotspots de outras telas que
            levavam até aqui. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {impacts === null ? (
          <p className="flex items-center gap-2 text-body-small text-on-surface-variant">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando tarefas ligadas a essas telas…
          </p>
        ) : impacts.length > 0 ? (
          <div className="rounded-xl border border-error/30 bg-error-container px-4 py-3 text-body-small text-on-error-container space-y-2">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Estas telas estão ligadas a tarefas (elas continuam existindo):
            </p>
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pl-6 list-disc">
              {impacts.map((i, n) => (
                <li key={n}>
                  <strong className="font-medium">{i.task}</strong> — {i.effect}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-body-small text-on-surface-variant">Nenhuma tarefa usa essas telas.</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={busy || impacts === null}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Lixeira de uma tela da lista (abre a confirmação com o impacto). */
export function DeleteScreenButton({ studyId, screenId, name }: { studyId: string; screenId: string; name: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Excluir tela"
        aria-label={`Excluir a tela ${name}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:text-red-700 hover:bg-surface-container-high"
      >
        <TrashIcon />
      </button>
      <ScreenDeleteDialog
        studyId={studyId}
        screenIds={[screenId]}
        label={`a tela “${name}”`}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
