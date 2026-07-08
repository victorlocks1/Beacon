"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { Pencil, Lock, Loader2, Trash2, RotateCcw, Gauge } from "lucide-react"
import { setSumEnabledAction, updateSumStatementAction } from "@/app/(dashboard)/studies/[id]/actions"

function isRedirect(e: unknown) {
  const d = (e as { digest?: unknown })?.digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

// Editor da SUM: explica as 4 dimensões e deixa editar o enunciado da SEQ.
// A coleta liga em TODAS as tarefas (flag do estudo). "Remover" desliga.
export function SumEditor({
  studyId,
  editable,
  statement, // resolvido (custom ou padrão do idioma)
  defaultStatement,
  anchors,
  onRemoved,
}: {
  studyId: string
  editable: boolean
  statement: string
  defaultStatement: string
  anchors: { low: string; high: string }
  onRemoved?: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(statement)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateSumStatementAction(studyId, val.trim() || null)
        toast.success("Pergunta da SUM salva")
        setEditing(false)
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível salvar.")
      }
    })
  }

  function restore() {
    setVal(defaultStatement)
    startTransition(async () => {
      try {
        await updateSumStatementAction(studyId, null)
        toast.success("Pergunta padrão restaurada")
        setEditing(false)
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível restaurar.")
      }
    })
  }

  function remove() {
    startTransition(async () => {
      try {
        await setSumEnabledAction(studyId, false)
        toast.success("SUM removida")
        onRemoved?.()
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível remover.")
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title-medium text-on-surface">Métrica SUM</h2>
          <p className="text-body-small text-on-surface-variant mt-0.5">
            Single Usability Metric — combina 4 dimensões por tarefa numa nota de 0 a 100%. É
            coletada após <strong className="text-on-surface font-medium">cada tarefa</strong> do
            estudo.
          </p>
        </div>
        {editable && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="shrink-0">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar pergunta
          </Button>
        )}
      </div>

      {/* As 4 dimensões */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { t: "Conclusão", d: "Concluiu a tarefa? (automático)" },
          { t: "Tempo", d: "Tempo real vs. ideal (KLM, automático)" },
          { t: "Erros", d: "Misclicks + desvios (automático)" },
          { t: "Satisfação", d: "Pergunta SEQ ao testador" },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-outline-variant p-3">
            <p className="text-label-large text-on-surface flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-on-surface-variant" />
              {x.t}
            </p>
            <p className="text-label-small text-on-surface-variant mt-0.5">{x.d}</p>
          </div>
        ))}
      </div>

      {/* Pergunta SEQ (satisfação) */}
      <div className="space-y-2">
        <p className="text-title-small text-on-surface">Pergunta de satisfação (SEQ · escala 1–7)</p>
        {editing ? (
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-outline bg-transparent px-3 py-2 text-body-medium text-on-surface outline-none focus:border-primary resize-none"
          />
        ) : (
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
            <p className="text-body-medium text-on-surface">{val}</p>
            <div className="mt-2 flex items-center justify-between text-label-small text-on-surface-variant">
              <span>1 · {anchors.low}</span>
              <span>{anchors.high} · 7</span>
            </div>
          </div>
        )}
        {!editing && (
          <p className="flex items-center gap-1.5 text-label-medium text-on-surface-variant">
            <Lock className="h-3.5 w-3.5" /> Padrão do método. Clique em Editar para personalizar.
          </p>
        )}
      </div>

      {editable && (
        <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-surface border-t border-outline-variant">
          {editing ? (
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
              <Button variant="ghost" onClick={() => { setVal(statement); setEditing(false) }} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="ghost" onClick={restore} disabled={pending} className="ml-auto text-on-surface-variant">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Restaurar padrão
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={remove} disabled={pending} className="text-on-surface-variant">
              <Trash2 className="h-4 w-4 mr-2" /> Remover SUM
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
