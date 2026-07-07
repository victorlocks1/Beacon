"use client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  figmaRefreshAction,
  loadFigmaImagesAction,
} from "@/app/(dashboard)/studies/[id]/figma/actions"

type Phase = "idle" | "busy" | "done"

// Re-sincroniza as telas com o Figma (nomes/tamanho/scroll + telas novas) e, na
// sequência, JÁ baixa as imagens do heatmap — assim ficam prontas na plataforma
// inteira (não só quando alguém abre os Resultados). Só aparece com o estudo
// editável (a página que renderiza esconde no ao vivo).
export function RefreshFigmaButton({ studyId }: { studyId: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("idle")
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (doneTimer.current) clearTimeout(doneTimer.current)
  }, [])

  async function run() {
    if (phase === "busy") return
    setPhase("busy")
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
      const img = await loadFigmaImagesAction(studyId)
      if (!img.ok) toast.error(img.error)
      router.refresh()

      // estado breve de "carregado com sucesso" e volta pro normal
      setPhase("done")
      doneTimer.current = setTimeout(() => setPhase("idle"), 2200)
    } catch {
      toast.error("Falha ao atualizar o protótipo.")
      setPhase("idle")
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={phase === "busy"}>
      {phase === "busy" ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : phase === "done" ? (
        <Check className="h-4 w-4 mr-2 text-emerald-600" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {phase === "done" ? "Carregado com sucesso" : "Atualizar protótipo"}
    </Button>
  )
}
