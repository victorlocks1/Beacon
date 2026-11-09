"use client"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFigmaImageSync } from "@/components/prototype/figma-images-sync"

// Tela importada do Figma ainda sem imagem: baixa as imagens das telas (em
// lotes, até terminar) para o editor de hotspots ter onde desenhar.
export function FigmaScreenImageLoader({ studyId }: { studyId: string }) {
  const { running, error, retry } = useFigmaImageSync(studyId, 1)
  return (
    <div className="py-24 flex flex-col items-center gap-3 text-center">
      {running || !error ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
          <p className="text-body-medium text-on-surface-variant">Carregando a tela do Figma…</p>
        </>
      ) : (
        <>
          <p className="text-body-medium text-on-surface-variant max-w-md">{error}</p>
          <Button variant="outline" onClick={() => void retry()}>
            Tentar de novo
          </Button>
        </>
      )}
    </div>
  )
}
