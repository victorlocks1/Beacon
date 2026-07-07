"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, ImageDown } from "lucide-react"
import { toast } from "@/components/ui/toast"
import { loadFigmaImagesAction } from "@/app/(dashboard)/studies/[id]/figma/actions"

// Carrega as imagens das telas (fundo do heatmap) sob demanda. O import ao vivo
// não baixa imagens; este botão busca as que faltam quando o dono quer ver o
// heatmap com o fundo.
export function LoadFigmaImagesButton({ studyId, pending }: { studyId: string; pending: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await loadFigmaImagesAction(studyId)
      if (!res.ok) {
        toast.error(res.error)
      } else {
        toast.success(`${res.loaded} imagem(ns) carregada(s)`)
        router.refresh()
      }
    } catch {
      toast.error("Não foi possível carregar as imagens.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy} className="gap-1.5">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
      Carregar imagens ({pending})
    </Button>
  )
}
