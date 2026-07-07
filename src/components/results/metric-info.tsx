"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"

// Ícone (i) no padrão Google Icons (Material Symbols "info", outline) em 16px.
// O tooltip com a explicação da métrica aparece no HOVER (e no foco de teclado).
export function MetricInfo({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        role="img"
        aria-label="O que é esta métrica?"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-on-surface-variant/50 hover:text-on-surface-variant focus:text-on-surface-variant outline-none transition-colors cursor-help"
      >
        <InfoIcon />
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute right-0 top-6 z-50 w-60 rounded-2xl bg-surface-container-lowest p-4 text-left text-body-small text-on-surface-variant"
        >
          {text}
        </span>
      )}
    </span>
  )
}

// "info" do Google Material Symbols (outline), 16px.
function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      className="block"
    >
      <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    </svg>
  )
}
