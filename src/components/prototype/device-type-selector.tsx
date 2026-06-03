"use client"
import { updateDeviceTypeAction } from "@/app/(dashboard)/studies/[id]/actions"
import { Monitor, Tablet, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTransition } from "react"

type DeviceType = "desktop" | "tablet" | "mobile"

const options: { value: DeviceType; label: string; icon: React.ElementType; width: string }[] = [
  { value: "mobile", label: "Mobile", icon: Smartphone, width: "390px" },
  { value: "tablet", label: "Tablet", icon: Tablet, width: "768px" },
  { value: "desktop", label: "Desktop", icon: Monitor, width: "1280px" },
]

interface Props {
  studyId: string
  current: DeviceType
}

export function DeviceTypeSelector({ studyId, current }: Props) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = current === opt.value
        return (
          <button
            key={opt.value}
            disabled={pending}
            onClick={() => {
              const fd = new FormData()
              fd.set("deviceType", opt.value)
              startTransition(() => updateDeviceTypeAction(studyId, fd))
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={`${opt.label} — ${opt.width}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
