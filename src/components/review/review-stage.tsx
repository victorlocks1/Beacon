"use client"
import { useEffect, useState } from "react"
import { Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// A revisão roda o fluxo EXATAMENTE como o testador vê: em tela cheia, sem a
// moldura do painel (que cortava/encolhia o protótipo). O fluxo só é montado ao
// abrir, e é desmontado ao sair — cada abertura começa do zero.
export function ReviewStage({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  // trava a rolagem da página por baixo e fecha no Esc
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!open) {
    return (
      <div className="rounded-3xl border border-outline-variant bg-surface-container-low py-20 px-6 text-center space-y-4">
        <h2 className="text-title-large text-on-surface">Ver como o testador</h2>
        <p className="text-body-medium text-on-surface-variant max-w-md mx-auto">
          Abre o fluxo completo em tela cheia, do jeito que aparece no link do testador. Nada é
          gravado.
        </p>
        <Button size="lg" className="h-12 px-6" onClick={() => setOpen(true)}>
          <Play className="h-4 w-4 mr-2" />
          Iniciar revisão
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-surface">
      {children}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="fixed top-3 right-3 z-[110] inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-label-large text-on-surface shadow-md hover:bg-surface-container-high"
      >
        <X className="h-4 w-4" />
        Sair da revisão
      </button>
    </div>
  )
}
