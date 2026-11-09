"use client"
import { Loader2 } from "lucide-react"
import { useFigmaImageSync } from "@/components/prototype/figma-images-sync"

// Carrega automaticamente as imagens das telas (fundo do heatmap) que faltam.
export function FigmaImagesAutoLoad({ studyId, pending }: { studyId: string; pending: number }) {
  const { running } = useFigmaImageSync(studyId, pending)
  if (!running) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-body-small text-on-surface-variant">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando imagens das telas…
    </span>
  )
}
