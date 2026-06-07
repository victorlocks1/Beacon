"use client"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  publishStudyAction,
  closeStudyAction,
  reopenStudyAction,
} from "@/app/(dashboard)/studies/[id]/actions"
import { Rocket, Copy, Check, Lock, RotateCw, Loader2 } from "lucide-react"

type Status = "draft" | "live" | "closed"

interface Props {
  studyId: string
  status: Status
  canPublish: boolean
}

export function PublishBar({ studyId, status, canPublish }: Props) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/t/${studyId}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        // Fallback para contexto não seguro (ex.: acesso via IP da rede em HTTP),
        // onde navigator.clipboard não está disponível.
        const ta = document.createElement("textarea")
        ta.value = url
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Último recurso: mostra o link para cópia manual
      window.prompt("Copie o link do teste:", url)
    }
  }

  if (status === "draft") {
    return (
      <Button
        disabled={pending || !canPublish}
        title={canPublish ? undefined : "Adicione telas e uma missão primeiro"}
        onClick={() => startTransition(() => publishStudyAction(studyId))}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4 mr-2" />
        )}
        Publicar
      </Button>
    )
  }

  if (status === "live") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={copyLink}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => closeStudyAction(studyId))}
        >
          <Lock className="h-4 w-4 mr-2" />
          Encerrar
        </Button>
      </div>
    )
  }

  // closed
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => reopenStudyAction(studyId))}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RotateCw className="h-4 w-4 mr-2" />
      )}
      Reabrir
    </Button>
  )
}
