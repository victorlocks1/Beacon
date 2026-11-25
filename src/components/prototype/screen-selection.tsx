"use client"
import { createContext, useContext, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/toast"
import { deleteScreensAction } from "@/app/(dashboard)/studies/[id]/actions"

// Seleção de várias telas na aba Protótipo para excluir de uma vez. A lista é
// renderizada no servidor; este provider guarda só quais telas estão marcadas.
type Ctx = {
  selected: Set<string>
  toggle: (id: string) => void
  allIds: string[]
  setAll: (on: boolean) => void
}
const SelectionContext = createContext<Ctx | null>(null)

export function ScreenSelectionProvider({ allIds, children }: { allIds: string[]; children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // telas que sumiram (excluídas/atualizadas) deixam de contar como marcadas
  const live = new Set([...selected].filter((id) => allIds.includes(id)))
  const ctx: Ctx = {
    selected: live,
    allIds,
    toggle: (id) =>
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    setAll: (on) => setSelected(on ? new Set(allIds) : new Set()),
  }
  return <SelectionContext.Provider value={ctx}>{children}</SelectionContext.Provider>
}

function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error("ScreenSelectionProvider ausente")
  return ctx
}

/** Caixa de seleção de uma tela da lista. */
export function ScreenCheckbox({ id, name }: { id: string; name: string }) {
  const { selected, toggle } = useSelection()
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Selecionar a tela ${name}`}
      className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
    />
  )
}

/** "Selecionar todas" + "Excluir selecionadas (N)", com confirmação. */
export function BulkScreenActions({ studyId }: { studyId: string }) {
  const router = useRouter()
  const { selected, allIds, setAll } = useSelection()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const count = selected.size
  const allOn = count > 0 && count === allIds.length

  async function confirm() {
    setBusy(true)
    try {
      const res = await deleteScreensAction(studyId, [...selected])
      setOpen(false)
      setAll(false)
      if (res.deleted > 0) toast.success(`${res.deleted} tela(s) excluída(s)`)
      if (res.blocked.length > 0) {
        toast.error(
          `${res.blocked.length} tela(s) não foram excluídas porque estão em missões: ${res.blocked.join(", ")}. Remova-as das missões antes.`
        )
      }
      router.refresh()
    } catch {
      toast.error("Não foi possível excluir as telas.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <label className="flex items-center gap-2 text-body-small text-on-surface-variant cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allOn}
          ref={(el) => {
            if (el) el.indeterminate = count > 0 && !allOn
          }}
          onChange={() => setAll(!allOn)}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
        Selecionar todas
      </label>
      {count > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-error hover:text-error"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir selecionadas ({count})
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {count} tela(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove as telas selecionadas do protótipo, com os hotspots e regiões delas, e os
              hotspots de outras telas que levavam até elas. Telas usadas em missões não são
              excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir {count} tela(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
