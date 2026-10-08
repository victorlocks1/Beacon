"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadFigmaImagesAction } from "@/app/(dashboard)/studies/[id]/figma/actions"

// Tela importada do Figma ao vivo ainda sem imagem: baixa as imagens das telas
// e recarrega a página, para o editor de hotspots ter onde desenhar.
export function FigmaScreenImageLoader({ studyId }: { studyId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const fired = useRef(false)

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await loadFigmaImagesAction(studyId)
      if (!res.ok) setError(res.error)
      else if (res.loaded > 0) router.refresh()
      else setError("O Figma não devolveu a imagem desta tela. Tente de novo em instantes.")
    } catch {
      setError("Não foi possível carregar a imagem da tela.")
    } finally {
      setBusy(false)
    }
  }, [studyId, router])

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void load()
  }, [load])

  return (
    <div className="py-24 flex flex-col items-center gap-3 text-center">
      {busy ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
          <p className="text-body-medium text-on-surface-variant">Carregando a tela do Figma…</p>
        </>
      ) : (
        <>
          <p className="text-body-medium text-on-surface-variant max-w-md">{error}</p>
          <Button variant="outline" onClick={load}>
            Tentar de novo
          </Button>
        </>
      )}
    </div>
  )
}
