"use client"
import { useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createStudyAction } from "@/app/(dashboard)/studies/actions"
import { SubmitButton } from "@/components/submit-button"
import { Plus } from "lucide-react"

export function CreateStudyDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants(), "cursor-pointer")}>
        <Plus className="w-4 h-4 mr-2" />
        Novo study
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo study</DialogTitle>
        </DialogHeader>
        <form action={createStudyAction} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              name="title"
              placeholder="Ex: Checkout Flow — v2"
              required
              autoFocus
            />
          </div>
          <SubmitButton>Criar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
