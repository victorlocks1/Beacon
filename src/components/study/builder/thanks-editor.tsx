"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { M3TextField } from "@/components/ui/m3-text-field"
import { M3Textarea } from "@/components/ui/m3-textarea"
import { toast } from "@/components/ui/toast"
import { Loader2 } from "lucide-react"
import { updateThanksAction } from "@/app/(dashboard)/studies/[id]/actions"

function isRedirect(e: unknown) {
  const d = (e as { digest?: unknown })?.digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

// Editor inline da tela de agradecimento (mesmo modelo da boas-vindas).
export function ThanksEditor({
  studyId,
  editable,
  title,
  message,
  defaultTitle,
  defaultMessage,
}: {
  studyId: string
  editable: boolean
  title: string | null
  message: string | null
  defaultTitle: string
  defaultMessage: string
}) {
  const router = useRouter()
  const [t, setT] = useState(title ?? "")
  const [m, setM] = useState(message ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateThanksAction(studyId, { title: t, message: m })
        toast.success("Agradecimento salvo")
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível salvar.")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title-medium text-on-surface">Tela de agradecimento</h2>
        <p className="text-body-small text-on-surface-variant mt-0.5">
          O que o testador vê ao concluir o teste.
        </p>
      </div>

      <fieldset disabled={!editable} className="space-y-5 pb-2 disabled:opacity-60">
        <div className="space-y-1.5">
          <M3TextField label="Título" value={t} onChange={(e) => setT(e.target.value)} />
          <p className="text-body-small text-on-surface-variant px-1">
            Deixe em branco para usar “{defaultTitle}”.
          </p>
        </div>

        <div className="space-y-1.5">
          <M3Textarea
            label="Mensagem"
            value={m}
            onChange={(e) => setM(e.target.value)}
            className="min-h-28"
          />
          <p className="text-body-small text-on-surface-variant px-1">
            Deixe em branco para usar “{defaultMessage}”.
          </p>
        </div>
      </fieldset>

      {editable && (
        <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-surface border-t border-outline-variant flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      )}
    </div>
  )
}
