"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { M3TextField } from "@/components/ui/m3-text-field"
import { M3Textarea } from "@/components/ui/m3-textarea"
import { toast } from "@/components/ui/toast"
import { Loader2 } from "lucide-react"
import { updateWelcomeAction } from "@/app/(dashboard)/studies/[id]/actions"

function isRedirect(e: unknown) {
  const d = (e as { digest?: unknown })?.digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

// Editor inline da tela de boas-vindas (mesmo modelo do WelcomeDialog).
export function WelcomeEditor({
  studyId,
  editable,
  title,
  message,
  howItWorks,
  defaultTitle,
}: {
  studyId: string
  editable: boolean
  title: string | null
  message: string | null
  howItWorks: string | null
  defaultTitle: string
}) {
  const router = useRouter()
  const [t, setT] = useState(title ?? "")
  const [m, setM] = useState(message ?? "")
  const [hiw, setHiw] = useState(howItWorks ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateWelcomeAction(studyId, { title: t, message: m, howItWorks: hiw })
        toast.success("Boas-vindas salvas")
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
        <h2 className="text-title-medium text-on-surface">Tela de boas-vindas</h2>
        <p className="text-body-small text-on-surface-variant mt-0.5">
          O que o testador vê ao abrir o link, antes das tarefas.
        </p>
      </div>

      <fieldset disabled={!editable} className="space-y-5 disabled:opacity-60">
        <div className="space-y-1.5">
          <M3TextField label="Título" value={t} onChange={(e) => setT(e.target.value)} />
          <p className="text-body-small text-on-surface-variant px-1">
            Deixe em branco para usar “{defaultTitle}”.
          </p>
        </div>

        <div className="space-y-1.5">
          <M3Textarea
            label="Mensagem de boas-vindas"
            value={m}
            onChange={(e) => setM(e.target.value)}
            className="min-h-28"
          />
          <p className="text-body-small text-on-surface-variant px-1">
            Deixe em branco para usar o texto padrão do idioma.
          </p>
        </div>

        <div className="space-y-1.5">
          <M3Textarea
            label="Como funciona"
            value={hiw}
            onChange={(e) => setHiw(e.target.value)}
            className="min-h-28"
          />
          <p className="text-body-small text-on-surface-variant px-1">
            Tela extra depois das boas-vindas e antes das tarefas. Em branco = não mostrar.
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
