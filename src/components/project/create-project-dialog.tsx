"use client"
import { useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { M3TextField } from "@/components/ui/m3-text-field"
import { SubmitButton } from "@/components/submit-button"
import { createProjectAction } from "@/app/(dashboard)/projects/actions"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants(), "cursor-pointer")}>
        <Plus className="w-4 h-4 mr-2" />
        Novo projeto
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md rounded-[28px] p-0 gap-0 ring-0 border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      >
        <div className="p-8">
          <div className="flex items-start justify-between mb-8">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-on-surface">
              Criar novo projeto
            </DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" />}>
              <X />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </div>

          <form action={createProjectAction} className="space-y-8">
            <M3TextField label="Nome do projeto" name="name" labelBg="bg-popover" required autoFocus />
            <SubmitButton className="w-full">Criar projeto</SubmitButton>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
