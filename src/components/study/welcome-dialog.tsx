"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { M3TextField } from "@/components/ui/m3-text-field"
import { Textarea } from "@/components/ui/textarea"
import { updateWelcomeAction } from "@/app/(dashboard)/studies/[id]/actions"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { Pencil, X, Loader2 } from "lucide-react"

// Deixa o NEXT_REDIRECT (ex.: bloqueio de estudo ao vivo) propagar sem virar toast de erro.
function isRedirect(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}

export function WelcomeDialog({
  studyId,
  title,
  message,
  defaultTitle,
  defaultMessage,
}: {
  studyId: string
  title: string | null
  message: string | null
  defaultTitle: string
  defaultMessage: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [t, setT] = useState(title ?? "")
  const [m, setM] = useState(message ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateWelcomeAction(studyId, { title: t, message: m })
        toast.success("Boas-vindas salvas")
        setOpen(false)
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível salvar.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setT(title ?? "")
          setM(message ?? "")
        }
      }}
    >
      <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
        <Pencil className="h-3.5 w-3.5 mr-1.5" />
        Editar
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg rounded-[28px] p-0 gap-0 ring-0 border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      >
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-on-surface">
              Tela de boas-vindas
            </DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" />}>
              <X />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </div>

          <div className="space-y-5">
            <p className="text-body-small text-on-surface-variant -mt-2">
              O que o testador vê ao abrir o link, antes das tarefas. Deixe em branco para usar o
              texto padrão do idioma.
            </p>

            <div className="space-y-1.5">
              <M3TextField
                label="Título"
                value={t}
                onChange={(e) => setT(e.target.value)}
                labelBg="bg-popover"
              />
              <p className="text-body-small text-on-surface-variant px-1">
                Padrão: “{defaultTitle}”.
              </p>
            </div>

            <div className="space-y-1.5">
              <Textarea
                value={m}
                onChange={(e) => setM(e.target.value)}
                placeholder={defaultMessage}
                className="rounded-lg min-h-28"
              />
              <p className="text-body-small text-on-surface-variant px-1">Mensagem de boas-vindas.</p>
            </div>

            <Button onClick={save} disabled={pending} className="w-full h-12">
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
