"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { Pencil, Lock, Loader2, Trash2, RotateCcw, Gauge } from "lucide-react"
import { setSumEnabledAction, updateSumStatementsAction } from "@/app/(dashboard)/studies/[id]/actions"

function isRedirect(e: unknown) {
  const d = (e as { digest?: unknown })?.digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

// Editor da SUM: explica as 4 dimensões e deixa editar as 3 perguntas do ASQ.
// A coleta liga em TODAS as tarefas (flag do estudo). "Remover" desliga.
export function SumEditor({
  studyId,
  editable,
  statements, // resolvidos (custom ou padrão do idioma) — 3
  defaultStatements, // 3
  labels, // rótulos curtos das 3 dimensões
  anchors,
  onRemoved,
}: {
  studyId: string
  editable: boolean
  statements: string[]
  defaultStatements: string[]
  labels: string[]
  anchors: { low: string; high: string }
  onRemoved?: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [vals, setVals] = useState<string[]>(statements)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateSumStatementsAction(studyId, vals.map((v) => v.trim()))
        toast.success("Perguntas da SUM salvas")
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
        await updateSumStatementsAction(studyId, null)
        toast.success("Perguntas padrão restauradas")
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
            Editar perguntas
          </Button>
        )}
      </div>

      {/* As 4 dimensões */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { t: "Conclusão", d: "Concluiu a tarefa? (automático)" },
          { t: "Tempo", d: "Tempo real vs. ideal (KLM, automático)" },
          { t: "Erros", d: "Misclicks + desvios (automático)" },
          { t: "Satisfação", d: "3 perguntas ASQ ao testador" },
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

      {/* Perguntas do ASQ (satisfação) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-title-small text-on-surface">Perguntas de satisfação (ASQ · escala 1–7)</p>
          <span className="text-label-small text-on-surface-variant">
            1 · {anchors.low} → {anchors.high} · 7
          </span>
        </div>
        {vals.map((st, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3",
              editing ? "border-outline bg-surface" : "border-outline-variant bg-surface-container-low"
            )}
          >
            <span className="text-label-medium text-on-surface-variant mt-2 w-16 shrink-0">
              {labels[i] ?? `#${i + 1}`}
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
              <Button variant="ghost" onClick={() => { setVals(statements); setEditing(false) }} disabled={pending}>
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
