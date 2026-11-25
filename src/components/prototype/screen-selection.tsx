"use client"
import { createContext, useContext, useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { ScreenDeleteDialog } from "@/components/prototype/screen-delete-dialog"

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

/** "Selecionar todas" + "Excluir selecionadas (N)", com o aviso de impacto. */
export function BulkScreenActions({ studyId }: { studyId: string }) {
  const { selected, allIds, setAll } = useSelection()
  const [open, setOpen] = useState(false)
  const count = selected.size
  const allOn = count > 0 && count === allIds.length

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
      <ScreenDeleteDialog
        studyId={studyId}
        screenIds={[...selected]}
        label={count === 1 ? "1 tela" : `${count} telas`}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => setAll(false)}
      />
    </>
  )
}
