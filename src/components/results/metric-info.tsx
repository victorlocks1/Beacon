"use client"
import { useState, useRef, useEffect } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

// Ícone (i) que abre um tooltip explicando a métrica (o que é + como é calculada).
export function MetricInfo({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="O que é esta métrica?"
        className="text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute right-0 top-6 z-50 w-60 rounded-xl bg-surface-container-lowest p-3 text-left text-body-small text-on-surface-variant ring-1 ring-black/5 elevation-3"
        >
          {text}
        </span>
      )}
    </span>
  )
}
