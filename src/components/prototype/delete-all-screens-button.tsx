"use client"
import { useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Trash2 } from "lucide-react"
import { ScreenDeleteDialog } from "@/components/prototype/screen-delete-dialog"

export function DeleteAllScreensButton({ studyId, screenIds }: { studyId: string; screenIds: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5 text-on-surface-variant hover:text-error cursor-pointer"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir todas
      </button>
      <ScreenDeleteDialog
        studyId={studyId}
        screenIds={screenIds}
        label={`todas as ${screenIds.length} telas`}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
