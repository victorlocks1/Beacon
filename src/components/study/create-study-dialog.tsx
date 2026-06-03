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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createStudyAction } from "@/app/(dashboard)/studies/actions"
import { SubmitButton } from "@/components/submit-button"
import { Plus, Smartphone, Tablet, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

type DeviceType = "mobile" | "tablet" | "desktop"

const deviceOptions: { value: DeviceType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "mobile", label: "Mobile", desc: "390px", icon: Smartphone },
  { value: "tablet", label: "Tablet", desc: "768px", icon: Tablet },
  { value: "desktop", label: "Desktop", desc: "1280px", icon: Monitor },
]

export function CreateStudyDialog() {
  const [open, setOpen] = useState(false)
  const [device, setDevice] = useState<DeviceType>("desktop")

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
        <form action={createStudyAction} className="space-y-5 mt-2">
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

          <div className="space-y-2">
            <Label>Tipo de dispositivo</Label>
            <div className="grid grid-cols-3 gap-2">
              {deviceOptions.map((opt) => {
                const Icon = opt.icon
                const active = device === opt.value
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 cursor-pointer transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="deviceType"
                      value={opt.value}
                      checked={active}
                      onChange={() => setDevice(opt.value)}
                      className="sr-only"
                    />
                    <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>
                      {opt.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <SubmitButton>Criar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
