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
import { createStudyAction } from "@/app/(dashboard)/studies/actions"
import { SubmitButton } from "@/components/submit-button"
import { Plus, Smartphone, Tablet, Monitor, X } from "lucide-react"
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

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md rounded-[28px] p-0 gap-0 ring-0 border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      >
        <div className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-on-surface">
              Criar novo study
            </DialogTitle>
            <DialogClose
              render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" />}
            >
              <X />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </div>

          <form action={createStudyAction} className="space-y-8">
            <M3TextField
              label="Título"
              name="title"
              labelBg="bg-popover"
              required
              autoFocus
            />

            <div className="space-y-3.5">
              <p className="text-title-small text-on-surface-variant">
                Tipo de dispositivo
              </p>
              <div className="grid grid-cols-3 gap-3">
                {deviceOptions.map((opt) => {
                  const Icon = opt.icon
                  const active = device === opt.value
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 cursor-pointer transition-colors",
                        active
                          ? "border-primary bg-primary/[0.04]"
                          : "border-outline-variant hover:border-on-surface-variant/50"
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
                      <Icon
                        className={cn(
                          "h-6 w-6",
                          active ? "text-primary" : "text-on-surface-variant"
                        )}
                      />
                      <span
                        className={cn(
                          "text-title-small",
                          active ? "text-on-surface" : "text-on-surface"
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-body-small text-on-surface-variant">
                        {opt.desc}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <SubmitButton className="h-12 mt-2">Criar</SubmitButton>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
