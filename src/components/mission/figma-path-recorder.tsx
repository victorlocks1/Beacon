"use client"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Play, Check, X, Flag } from "lucide-react"
import { dedupeConsecutive } from "@/lib/path"
import { figmaEmbedUrl } from "@/lib/figma-embed"
import { SavedPaths, toSteps, type PathStepInput } from "@/components/mission/path-steps-editor"

interface RecorderScreen {
  id: string
  name: string
  order: number
  figmaNodeId: string | null
}

interface Props {
  fileKey: string
  screens: RecorderScreen[]
  startScreenId: string | null
  paths: PathStepInput[][]
  onChange: (paths: PathStepInput[][]) => void
}

// Grava o caminho esperado navegando no protótipo VIVO do Figma (embed). Cada
// frame apresentado (PRESENTED_NODE_CHANGED) é mapeado para a tela e entra no
// caminho. Serve os estudos importados ao vivo (sem imagem para o player).
export function FigmaPathRecorder({ fileKey, screens, startScreenId, paths, onChange }: Props) {
  const [recording, setRecording] = useState<string[] | null>(null)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)

  const screenById = new Map(screens.map((s) => [s.id, s]))
  // figmaNodeId → screenId (para traduzir os eventos do embed)
  const screenByNode: Record<string, string> = {}
  for (const s of screens) if (s.figmaNodeId) screenByNode[s.figmaNodeId] = s.id
  // quantas telas compartilham cada nome (para oferecer "qualquer do grupo")
  const countByName = new Map<string, number>()
  for (const s of screens) countByName.set(s.name, (countByName.get(s.name) ?? 0) + 1)
  const nameCount = (id: string) => countByName.get(screenById.get(id)?.name ?? "") ?? 0

  const startNodeId = startScreenId ? screenById.get(startScreenId)?.figmaNodeId ?? null : null

  function name(id: string) {
    const s = screenById.get(id)
    return s ? `${s.order + 1}. ${s.name}` : "?"
  }

  const startRecording = useCallback(() => {
    if (!startScreenId) return
    setEmbedSrc(figmaEmbedUrl({ fileKey, startNodeId, host: window.location.host }))
    setRecording([startScreenId])
  }, [fileKey, startNodeId, startScreenId])

  function finalize() {
    if (!recording || recording.length < 2) return
    onChange([...paths, toSteps(recording)])
    setRecording(null)
    setEmbedSrc(null)
  }

  function cancel() {
    setRecording(null)
    setEmbedSrc(null)
  }

  // Escuta os eventos do embed enquanto grava e monta o caminho.
  useEffect(() => {
    if (!recording) return
    function onMsg(e: MessageEvent) {
      if (!e.origin.includes("figma.com")) return
      const d = e.data
      if (!d || typeof d !== "object" || d.type !== "PRESENTED_NODE_CHANGED") return
      const nodeId = d.data?.presentedNodeId as string | undefined
      const screenId = nodeId ? screenByNode[nodeId] : undefined
      if (!screenId) return
      setRecording((r) => (r ? dedupeConsecutive([...r, screenId]) : r))
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording !== null])

  if (!startScreenId) {
    return (
      <p className="text-sm text-muted-foreground border-2 border-dashed rounded-lg p-4 text-center">
        Selecione a tela inicial acima para gravar o caminho esperado.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Caminhos já salvos (com toggles de opcional / qualquer do grupo) */}
      <SavedPaths paths={paths} onChange={onChange} screenName={name} nameCount={nameCount} />

      {recording ? (
        <div className="space-y-3 border rounded-xl p-3">
          {/* Breadcrumb do que já foi navegado */}
          <div className="flex items-center gap-1 flex-wrap text-xs">
            <span className="font-medium mr-1">Gravando:</span>
            {recording.map((sid, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded border",
                    idx === recording.length - 1 ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {name(sid)}
                </span>
                {idx < recording.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>

          {/* Protótipo vivo — navegue para gravar o caminho */}
          <div className="flex justify-center bg-surface-container rounded-lg p-3">
            <div
              className="bg-white rounded-2xl overflow-hidden shadow-sm aspect-[9/20] h-[520px] max-w-full"
            >
              {embedSrc && (
                <iframe
                  title="Protótipo"
                  src={embedSrc}
                  allowFullScreen
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={finalize} disabled={recording.length < 2}>
              <Flag className="h-3.5 w-3.5 mr-1.5" />
              Finalizar caminho ({recording.length} telas)
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={startRecording}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {paths.length === 0 ? "Gravar caminho esperado" : "Gravar outro caminho"}
        </Button>
      )}

      {paths.length > 0 && !recording && (
        <p className="flex items-center gap-1.5 text-xs text-green-600">
          <Check className="h-3.5 w-3.5" />
          {paths.length} caminho(s) salvo(s)
        </p>
      )}
    </div>
  )
}
