"use client"
import { useEffect, useState } from "react"
import { Check, AlertCircle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastKind = "success" | "error" | "info"
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

// Emissor a nível de módulo: permite chamar toast.success/error de qualquer
// componente cliente (inclusive dentro de startTransition) sem prop-drilling.
type Listener = (t: ToastItem) => void
let listeners: Listener[] = []
let counter = 0

function emit(kind: ToastKind, message: string) {
  const item: ToastItem = { id: ++counter, kind, message }
  listeners.forEach((l) => l(item))
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
}

const KIND_STYLE: Record<
  ToastKind,
  { icon: typeof Check; ring: string; iconColor: string }
> = {
  success: { icon: Check, ring: "ring-emerald-500/30", iconColor: "text-emerald-600" },
  error: { icon: AlertCircle, ring: "ring-error/30", iconColor: "text-error" },
  info: { icon: Info, ring: "ring-primary/30", iconColor: "text-primary" },
}

const DURATION = 4000

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: Listener = (t) => {
      setItems((prev) => [...prev, t])
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== t.id))
      }, DURATION)
    }
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  function dismiss(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => {
        const { icon: Icon, ring, iconColor } = KIND_STYLE[t.kind]
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "flex items-start gap-3 rounded-2xl bg-surface-container-lowest px-4 py-3 text-on-surface elevation-3 ring-1",
              ring,
              "animate-in fade-in slide-in-from-bottom-2 duration-200"
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} />
            <p className="flex-1 text-body-medium">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
