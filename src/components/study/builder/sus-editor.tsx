"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { Pencil, Lock, Loader2, Trash2, RotateCcw } from "lucide-react"
import { updateSusStatementsAction, deleteSusBlockAction } from "@/app/(dashboard)/studies/[id]/actions"

function isRedirect(e: unknown) {
  const d = (e as { digest?: unknown })?.digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

// Editor do bloco SUS: mostra os 10 enunciados + escala, BLOQUEADOS por padrão.
// "Editar" libera alterar o texto (padrão do método é fixo — editar é opcional).
export function SusEditor({
  studyId,
  blockId,
  editable,
  statements, // resolvidos (custom ou padrão do idioma)
  scaleOptions,
  defaultStatements,
  onDeleted,
}: {
  studyId: string
  blockId: string
  editable: boolean
  statements: string[]
  scaleOptions: string[]
  defaultStatements: string[]
  onDeleted?: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [vals, setVals] = useState<string[]>(statements)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateSusStatementsAction(studyId, vals.map((v) => v.trim()))
        toast.success("Enunciados do SUS salvos")
        setEditing(false)
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível salvar.")
      }
    })
  }

  function restore() {
    setVals(defaultStatements)
    startTransition(async () => {
      try {
        await updateSusStatementsAction(studyId, null)
        toast.success("Enunciados padrão restaurados")
        setEditing(false)
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível restaurar.")
      }
    })
  }

  function del() {
    startTransition(async () => {
      try {
        await deleteSusBlockAction(studyId, blockId)
        toast.success("SUS removido")
        onDeleted?.()
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível excluir.")
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title-medium text-on-surface">Questionário SUS</h2>
          <p className="text-body-small text-on-surface-variant mt-0.5">
            System Usability Scale — 10 afirmações padrão (escala 1–5), exibidas ao testador nesta
            posição. Vira uma nota de 0 a 100 nos resultados.
          </p>
        </div>
        {editable && !editing && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
          </div>
        )}
      </div>

      {!editing && (
        <p className="flex items-center gap-1.5 text-label-medium text-on-surface-variant">
          <Lock className="h-3.5 w-3.5" /> Bloqueado (padrão do método). Clique em Editar para alterar.
        </p>
      )}

      {/* Escala */}
      <div className="flex flex-wrap gap-2">
        {scaleOptions.map((o, i) => (
          <span
            key={i}
            className="rounded-full border border-outline-variant px-2.5 py-1 text-label-small text-on-surface-variant"
          >
            {i + 1}. {o}
          </span>
        ))}
      </div>

      {/* Enunciados */}
      <div className="space-y-2.5">
        {vals.map((st, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3",
              editing ? "border-outline bg-surface" : "border-outline-variant bg-surface-container-low"
            )}
          >
            <span className="text-label-medium text-on-surface-variant mt-2 w-5 shrink-0 text-right">
              {i + 1}
            </span>
            {editing ? (
              <textarea
                value={st}
                onChange={(e) => setVals((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                rows={2}
                className="flex-1 rounded-lg border border-outline bg-transparent px-3 py-2 text-body-medium text-on-surface outline-none focus:border-primary resize-none"
              />
            ) : (
              <p className="flex-1 text-body-medium text-on-surface py-1.5">{st}</p>
            )}
          </div>
        ))}
      </div>

      {editable && (
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-surface border-t border-outline-variant">
          {editing ? (
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
              <Button variant="ghost" onClick={() => { setVals(statements); setEditing(false) }} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="ghost" onClick={restore} disabled={pending} className="ml-auto text-on-surface-variant">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Restaurar padrão
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={del} disabled={pending} className="text-on-surface-variant">
              <Trash2 className="h-4 w-4 mr-2" /> Remover SUS
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
