"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { loadFigmaImagesAction } from "@/app/(dashboard)/studies/[id]/figma/actions"

// Carrega automaticamente as imagens das telas (fundo do heatmap) que faltam.
// O import ao vivo não baixa imagens; aqui elas são buscadas sob demanda na
// primeira vez que os resultados são abertos, e ficam salvas (não busca de novo).
export function FigmaImagesAutoLoad({ studyId, pending }: { studyId: string; pending: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    if (pending <= 0 || fired.current) return
    fired.current = true
    setBusy(true)
    loadFigmaImagesAction(studyId)
      .then((res) => {
        // só atualiza se algo foi carregado (evita loop quando o Figma limita)
        if (res.ok && res.loaded > 0) router.refresh()
      })
      .catch(() => {})
      .finally(() => setBusy(false))
  }, [pending, studyId, router])

  if (!busy) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-body-small text-on-surface-variant">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando imagens das telas…
    </span>
  )
}
