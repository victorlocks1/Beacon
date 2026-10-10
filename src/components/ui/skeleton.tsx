import { cn } from "@/lib/utils"

// Bloco cinza pulsante usado nas telas de carregamento (loading.tsx). Cada
// página monta o seu no FORMATO do conteúdo que vai chegar, para o clique ter
// resposta imediata e a tela não "pular" quando os dados aparecem.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-container-high", className)} />
}

/** Envoltório acessível de uma tela de carregamento. */
export function LoadingRegion({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando" className={className}>
      {children}
    </div>
  )
}
