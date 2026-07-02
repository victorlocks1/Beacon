"use client"
import { useState, useTransition, useEffect } from "react"
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
import { cn } from "@/lib/utils"
import { Users, X, Loader2, Copy, Check, Trash2 } from "lucide-react"
import {
  enableShareAction,
  addMemberByEmailAction,
  removeMemberAction,
} from "@/app/(dashboard)/studies/[id]/share/actions"

export type ShareMember = { userId: string; name: string; email: string }

export function ShareDialog({
  studyId,
  members,
  shareCode,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: {
  studyId: string
  members: ShareMember[]
  shareCode: string | null
  open?: boolean
  onOpenChange?: (v: boolean) => void
  hideTrigger?: boolean
}) {
  const router = useRouter()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const [code, setCode] = useState<string | null>(shareCode)
  const [email, setEmail] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  // Garante o link ao abrir (gera o código na 1ª vez)
  useEffect(() => {
    if (open && !code) {
      enableShareAction(studyId).then((r) => setCode(r.code)).catch(() => {})
    }
  }, [open, code, studyId])

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : ""

  function copy() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function addMember() {
    setMsg(null)
    startTransition(async () => {
      const res = await addMemberByEmailAction(studyId, email)
      if (res.ok) {
        setMsg({ ok: true, text: `${res.name} adicionado(a).` })
        setEmail("")
        router.refresh()
      } else {
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  function remove(userId: string) {
    startTransition(async () => {
      await removeMemberAction(studyId, userId)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}>
          <Users className="h-4 w-4 mr-2" />
          Compartilhar
        </DialogTrigger>
      )}

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg rounded-[28px] p-0 gap-0 ring-0 border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      >
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-on-surface">
              Compartilhar com o time
            </DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" />}>
              <X />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </div>

          <div className="space-y-6">
            <p className="text-body-small text-on-surface-variant -mt-2">
              Quem entrar pode <strong>ver o protótipo e comentar</strong> — não edita o estudo.
            </p>

            {/* Link */}
            <div className="space-y-2">
              <p className="text-title-small text-on-surface">Link de convite</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link || "Gerando..."}
                  className="flex-1 h-11 rounded-lg border border-outline bg-surface-container px-3 text-body-small text-on-surface outline-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" onClick={copy} disabled={!link} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-body-small text-on-surface-variant">
                Qualquer pessoa com conta que abrir o link entra como membro.
              </p>
            </div>

            {/* Convite por e-mail */}
            <div className="space-y-2">
              <p className="text-title-small text-on-surface">Convidar por e-mail</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <M3TextField
                    label="E-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    labelBg="bg-popover"
                  />
                </div>
                <Button onClick={addMember} disabled={pending || !email.trim()} className="shrink-0 h-14">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                </Button>
              </div>
              {msg && (
                <p className={cn("text-body-small", msg.ok ? "text-emerald-700" : "text-error")}>
                  {msg.text}
                </p>
              )}
            </div>

            {/* Membros */}
            {members.length > 0 && (
              <div className="space-y-2">
                <p className="text-title-small text-on-surface">Membros ({members.length})</p>
                <div className="space-y-1.5">
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 rounded-xl border border-outline-variant px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-body-medium text-on-surface truncate">{m.name}</p>
                        <p className="text-body-small text-on-surface-variant truncate">{m.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(m.userId)}
                        disabled={pending}
                        className="text-on-surface-variant hover:text-error"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
