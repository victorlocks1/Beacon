"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Trash2, Loader2 } from "lucide-react"
import { resetStudyDataAction } from "@/app/(dashboard)/studies/[id]/actions"

export function ResetDataButton({
  studyId,
  sessionCount,
}: {
  studyId: string
  sessionCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await resetStudyDataAction(studyId)
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        disabled={sessionCount === 0}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5 text-on-surface-variant hover:text-error cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Limpar dados
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limpar dados coletados?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso apaga <strong>{sessionCount} sessão(ões)</strong> e todos os eventos e
            resultados deste estudo, deixando os relatórios zerados. O protótipo, as telas e as
            missões <strong>não são afetados</strong>. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Limpar dados
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
