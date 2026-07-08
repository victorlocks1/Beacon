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
} from "@/components/ui/dropdown-menu"
import { ShareDialog, type ShareMember } from "@/components/study/share-dialog"
import { toast } from "@/components/ui/toast"
import {
  publishStudyAction,
  closeStudyAction,
  reopenStudyAction,
  ensureTesterCodeAction,
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

export function StudyHeaderActions({
  studyId,
  status,
  canPublish,
  members,
  shareCode,
}: {
  studyId: string
  status: Status
  canPublish: boolean
  members: ShareMember[]
  shareCode: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  async function writeClipboard(url: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        window.prompt("Copie o link do teste:", url)
        return
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copie o link do teste:", url)
    }
  }

  async function copyTesterLink() {
    // Link curto: /t/<código>. Gera o código na 1ª vez; cai no id se falhar.
    let path = `/t/${studyId}`
    try {
      const { code } = await ensureTesterCodeAction(studyId)
      path = `/t/${code}`
    } catch {
      /* mantém o link completo */
    }
    await writeClipboard(`${window.location.origin}${path}`)
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
          onClick={() =>
            startTransition(async () => {
              try {
                await publishStudyAction(studyId)
                toast.success("Estudo publicado")
              } catch {
                toast.error("Não foi possível concluir. Tente novamente.")
              }
            })
          }
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
          onClick={() =>
            startTransition(async () => {
              try {
                await reopenStudyAction(studyId)
                toast.success("Teste reaberto")
              } catch {
                toast.error("Não foi possível concluir. Tente novamente.")
              }
            })
          }
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
            Revisão
          </DropdownMenuItem>
          {status === "live" && (
            <>
              <DropdownMenuItem onClick={copyTesterLink}>
                <Link2 className="h-4 w-4" />
                Copiar link do testador
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await closeStudyAction(studyId)
                      toast.success("Teste encerrado")
                    } catch {
                      toast.error("Não foi possível concluir. Tente novamente.")
                    }
                  })
                }
              >
                <Lock className="h-4 w-4" />
                Encerrar teste
              </DropdownMenuItem>
            </>
          )}
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
