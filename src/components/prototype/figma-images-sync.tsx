"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadFigmaImagesAction } from "@/app/(dashboard)/studies/[id]/figma/actions"

// Baixa as imagens das telas do Figma que faltam, em lotes, até terminar — com
// progresso e erro VISÍVEIS. As imagens são obrigatórias para a réplica
// (arquivo restrito), para a tela exibida junto com perguntas, para os hotspots
// e para os heatmaps. Antes o download rodava uma vez, em segundo plano, e
// falhava em silêncio.
export function useFigmaImageSync(studyId: string, missing: number, { auto = true } = {}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(missing)
  const [error, setError] = useState<string | null>(null)
  const runningRef = useRef(false)

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    setError(null)
    try {
      // cada rodada = 1 pedido ao Figma (até 40 telas); para no primeiro erro
      for (let round = 0; round < 5; round++) {
        const res = await loadFigmaImagesAction(studyId)
        if (!res.ok) {
          setError(res.error)
          break
        }
        setRemaining(res.remaining)
        if (res.remaining === 0) break
      }
    } catch {
      setError("Não foi possível carregar as imagens das telas.")
    } finally {
      runningRef.current = false
      setRunning(false)
      router.refresh()
    }
  }, [studyId, router])

  const started = useRef(false)
  useEffect(() => {
    if (!auto || missing <= 0 || started.current) return
    started.current = true
    void run()
  }, [auto, missing, run])

  return { running, remaining, error, retry: run }
}

/** Faixa no topo do estudo enquanto faltam imagens de telas do Figma. */
export function FigmaImagesSyncBanner({
  studyId,
  missing,
  total,
}: {
  studyId: string
  missing: number
  total: number
}) {
  const { running, remaining, error, retry } = useFigmaImageSync(studyId, missing)
  if (missing <= 0) return null
  const done = total - remaining
  return (
    <div
      className={
        "mb-6 rounded-2xl border px-5 py-4 text-body-medium flex items-center gap-3 " +
        (error
          ? "border-error/30 bg-error-container text-on-error-container"
          : "border-outline-variant bg-surface-container text-on-surface-variant")
      }
    >
      {error ? (
        <AlertTriangle className="h-5 w-5 shrink-0" />
      ) : (
        <Loader2 className={"h-5 w-5 shrink-0 " + (running ? "animate-spin" : "")} />
      )}
      <div className="flex-1 min-w-0">
        {error ? (
          <>
            <strong className="font-medium">Faltam imagens de {remaining} tela(s) do Figma.</strong> {error}{" "}
            Sem elas, a réplica, a tela das perguntas e o gravador de caminho ficam vazios — e o
            estudo não pode ser publicado.
          </>
        ) : (
          <>
            Preparando as telas do Figma: {done} de {total}. O estudo poderá ser publicado quando
            terminar.
          </>
        )}
      </div>
      {error && !running && (
        <Button variant="outline" size="sm" onClick={() => void retry()}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
