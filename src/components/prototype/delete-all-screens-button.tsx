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
import { toast } from "@/components/ui/toast"
import { deleteAllScreensAction } from "@/app/(dashboard)/studies/[id]/actions"

export function DeleteAllScreensButton({
  studyId,
  screenCount,
}: {
  studyId: string
  screenCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await deleteAllScreensAction(studyId)
      setOpen(false)
      toast.success("Todas as telas foram excluídas")
      router.refresh()
    } catch {
      toast.error("Não foi possível excluir as telas.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5 text-on-surface-variant hover:text-error cursor-pointer"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir todas
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir todas as telas?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso remove as <strong>{screenCount} tela(s)</strong> do protótipo e todos os
            hotspots e regiões vinculados. Útil para recomeçar um novo upload. Esta ação não
            pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir todas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
