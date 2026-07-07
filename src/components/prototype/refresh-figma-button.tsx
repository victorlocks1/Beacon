"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  figmaRefreshAction,
  loadFigmaImagesAction,
} from "@/app/(dashboard)/studies/[id]/figma/actions"

type Phase = "idle" | "refreshing" | "loading-images"

// Re-sincroniza as telas com o Figma (nomes/tamanho/scroll + telas novas) e, na
// sequência, JÁ baixa as imagens do heatmap — assim ficam prontas na plataforma
// inteira (não só quando alguém abre os Resultados). Só aparece com o estudo
// editável (a página que renderiza esconde no ao vivo).
export function RefreshFigmaButton({ studyId }: { studyId: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("idle")
  const busy = phase !== "idle"

  async function run() {
    setPhase("refreshing")
    try {
      const res = await figmaRefreshAction(studyId)
      if (!res.ok) {
        toast.error(res.error)
        setPhase("idle")
        return
      }
      const parts: string[] = []
      if (res.updated) parts.push(`${res.updated} atualizada(s)`)
      if (res.added) parts.push(`${res.added} nova(s)`)
      toast.success(parts.length ? `Protótipo atualizado — ${parts.join(", ")}` : "Protótipo atualizado")

      // baixa as imagens das telas aqui mesmo (fundo do heatmap), sem esperar
      // abrir os Resultados
      setPhase("loading-images")
      const img = await loadFigmaImagesAction(studyId)
      if (!img.ok) toast.error(img.error)
      router.refresh()
    } catch {
      toast.error("Falha ao atualizar o protótipo.")
    } finally {
      setPhase("idle")
    }
  }

  const label =
    phase === "loading-images"
      ? "carregando imagens das telas…"
      : phase === "refreshing"
        ? "Atualizando…"
        : "Atualizar protótipo"

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  )
}
