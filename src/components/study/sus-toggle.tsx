"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ClipboardCheck, Check } from "lucide-react"
import { toast } from "@/components/ui/toast"
import { toggleSusAction } from "@/app/(dashboard)/studies/[id]/actions"

// Card no fim da sequência para ativar o questionário SUS (10 perguntas padrão,
// não editáveis) exibido ao testador ao final do teste.
export function SusToggle({
  studyId,
  enabled,
  editable,
}: {
  studyId: string
  enabled: boolean
  editable: boolean
}) {
  const router = useRouter()
  const [on, setOn] = useState(enabled)
  const [pending, startTransition] = useTransition()

  function toggle() {
    if (!editable || pending) return
    const next = !on
    setOn(next)
    startTransition(async () => {
      try {
        await toggleSusAction(studyId, next)
        toast.success(next ? "SUS ativado — 10 perguntas no fim do teste" : "SUS desativado")
        router.refresh()
      } catch {
        setOn(!next)
        toast.error("Não foi possível atualizar o SUS.")
      }
    })
  }

  return (
    <div className="mt-6 rounded-2xl border border-outline-variant bg-surface-container-low p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-title-small text-on-surface flex items-center gap-2">
              Questionário SUS
              {on && (
                <span className="inline-flex items-center gap-1 text-label-small text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> ativo
                </span>
              )}
            </p>
            <p className="text-body-small text-on-surface-variant mt-0.5">
              System Usability Scale — 10 perguntas padrão (escala 1–5) exibidas ao final do teste.
              As afirmações são fixas e não podem ser editadas. Vira uma nota de 0 a 100.
            </p>
          </div>
        </div>

        {/* Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={!editable || pending}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
            on ? "bg-primary" : "bg-surface-container-high"
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
              on ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>
    </div>
  )
}
