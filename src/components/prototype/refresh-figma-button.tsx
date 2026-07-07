"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { figmaRefreshAction } from "@/app/(dashboard)/studies/[id]/figma/actions"

// Re-sincroniza as telas com o Figma (nomes/tamanho/scroll + telas novas) e
// limpa as imagens do heatmap para refletir o visual atual. Só faz sentido
// enquanto o estudo não está no ar (a página que renderiza já esconde no live).
export function RefreshFigmaButton({ studyId }: { studyId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await figmaRefreshAction(studyId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const parts: string[] = []
      if (res.updated) parts.push(`${res.updated} atualizada(s)`)
      if (res.added) parts.push(`${res.added} nova(s)`)
      toast.success(parts.length ? `Protótipo atualizado — ${parts.join(", ")}` : "Protótipo atualizado")
      router.refresh()
    } catch {
      toast.error("Falha ao atualizar o protótipo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
      Atualizar protótipo
    </Button>
  )
}
