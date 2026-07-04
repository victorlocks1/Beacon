"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ShareDialog, type ShareMember } from "@/components/study/share-dialog"
import {
  publishStudyAction,
  closeStudyAction,
  reopenStudyAction,
} from "@/app/(dashboard)/studies/[id]/actions"
import { cn } from "@/lib/utils"
import {
  MoreHorizontal,
  BarChart3,
  Eye,
  Users,
  Rocket,
  Copy,
  Check,
  Lock,
  RotateCw,
  Loader2,
  Link2,
} from "lucide-react"

type Status = "draft" | "live" | "closed"

const statusLabel: Record<Status, string> = { draft: "Rascunho", live: "Ao vivo", closed: "Encerrado" }
const deviceLabel: Record<string, string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" }
const langLabel: Record<string, string> = { pt: "Português", es: "Espanhol" }

export function StudyHeaderActions({
  studyId,
  status,
  canPublish,
  members,
  shareCode,
  deviceType,
  language,
}: {
  studyId: string
  status: Status
  canPublish: boolean
  members: ShareMember[]
  shareCode: string | null
  deviceType: string
  language: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  function copyTesterLink() {
    const url = `${window.location.origin}/t/${studyId}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => window.prompt("Copie o link do teste:", url))
    } else {
      window.prompt("Copie o link do teste:", url)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Primária: Resultados */}
      <Link href={`/studies/${studyId}/results`} className={buttonVariants({ variant: "outline" })}>
        <BarChart3 className="h-4 w-4 mr-2" />
        Resultados
      </Link>

      {/* Primária: CTA por status */}
      {status === "draft" && (
        <Button
          disabled={pending || !canPublish}
          title={canPublish ? undefined : "Adicione telas e uma missão primeiro"}
          onClick={() => startTransition(() => publishStudyAction(studyId))}
        >
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
          Publicar
        </Button>
      )}
      {status === "live" && (
        <Button variant="outline" onClick={copyTesterLink}>
          {copied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
      )}
      {status === "closed" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => reopenStudyAction(studyId))}
        >
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}
          Reabrir
        </Button>
      )}

      {/* Mais opções */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "cursor-pointer")}
          aria-label="Mais opções"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => setTimeout(() => setShareOpen(true), 0)}>
            <Users className="h-4 w-4" />
            Compartilhar com o time
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/studies/${studyId}/review`)}>
            <Eye className="h-4 w-4" />
            Revisão (preview + comentários)
          </DropdownMenuItem>
          {status === "live" && (
            <>
              <DropdownMenuItem onClick={copyTesterLink}>
                <Link2 className="h-4 w-4" />
                Copiar link do testador
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => startTransition(() => closeStudyAction(studyId))}
              >
                <Lock className="h-4 w-4" />
                Encerrar teste
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <div className="px-3 pt-1 pb-1.5 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Informações
            </p>
            <p className="text-xs text-muted-foreground">
              Status: <span className="text-foreground">{statusLabel[status]}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Dispositivo: <span className="text-foreground">{deviceLabel[deviceType] ?? deviceType}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Idioma: <span className="text-foreground">{langLabel[language] ?? language}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Membros: <span className="text-foreground">{members.length}</span>
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog
        studyId={studyId}
        members={members}
        shareCode={shareCode}
        open={shareOpen}
        onOpenChange={setShareOpen}
        hideTrigger
      />
    </div>
  )
}
