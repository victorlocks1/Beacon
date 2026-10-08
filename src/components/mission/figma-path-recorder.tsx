"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Play, Check, X, Flag } from "lucide-react"
import { dedupeConsecutive } from "@/lib/path"
import { figmaEmbedUrl, runEmbedHotspotAction } from "@/lib/figma-embed"
import { buildFigmaRunnerMaps } from "@/lib/figma-runner"
import { clickContentPoint, hotspotAt } from "@/lib/figma-clicks"
import { frameLayout, type DeviceType } from "@/lib/device"
import { SavedPaths, toSteps, type PathStepInput } from "@/components/mission/path-steps-editor"

interface RecorderScreen {
  id: string
  name: string
  order: number
  figmaNodeId: string | null
  width: number
  height: number
  scrollFrames?: unknown
  // hotspots desenhados no Beacon: no embed, clicar neles navega como no teste
  hotspots?: {
    id: string
    coords: unknown
    action?: "navigate" | "open_overlay" | "close_overlay" | "back"
    targetScreenId?: string | null
  }[]
}

interface Props {
  fileKey: string
  deviceType: DeviceType // dispositivo do estudo: define o formato do quadro
  screens: RecorderScreen[]
  startScreenId: string | null
  paths: PathStepInput[][]
  onChange: (paths: PathStepInput[][]) => void
}

// Grava o caminho esperado navegando no protótipo VIVO do Figma (embed). Cada
// frame apresentado (PRESENTED_NODE_CHANGED) é mapeado para a tela e entra no
// caminho. Serve os estudos importados ao vivo (sem imagem para o player).
export function FigmaPathRecorder({ fileKey, deviceType, screens, startScreenId, paths, onChange }: Props) {
  const [recording, setRecording] = useState<string[] | null>(null)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // mesmos mapas do runner do testador (tela ↔ node do Figma, hotspots do Beacon)
  const maps = useMemo(
    () => buildFigmaRunnerMaps(screens.map((s) => ({ ...s, scrollFrames: s.scrollFrames ?? null })), []),
    [screens]
  )
  const mapsRef = useRef(maps)
  useEffect(() => {
    mapsRef.current = maps
  }, [maps])

  const screenById = new Map(screens.map((s) => [s.id, s]))
  // figmaNodeId → screenId (para traduzir os eventos do embed)
  const screenByNode: Record<string, string> = {}
  for (const s of screens) if (s.figmaNodeId) screenByNode[s.figmaNodeId] = s.id
  // quantas telas compartilham cada nome (para oferecer "qualquer do grupo")
  const countByName = new Map<string, number>()
  for (const s of screens) countByName.set(s.name, (countByName.get(s.name) ?? 0) + 1)
  const nameCount = (id: string) => countByName.get(screenById.get(id)?.name ?? "") ?? 0

  const startScreen = startScreenId ? screenById.get(startScreenId) : undefined
  const startNodeId = startScreen?.figmaNodeId ?? null
  // mesmo quadro do testador: proporção do frame (ou do viewport, se página longa)
  const layout = frameLayout(startScreen?.width ?? 0, startScreen?.height ?? 0, deviceType)

  function name(id: string) {
    const s = screenById.get(id)
    return s ? `${s.order + 1}. ${s.name}` : "?"
  }

  const startRecording = useCallback(() => {
    if (!startScreenId) return
    setEmbedSrc(
      figmaEmbedUrl({ fileKey, startNodeId, host: window.location.host, scaling: layout.scaling })
    )
    setRecording([startScreenId])
  }, [fileKey, startNodeId, startScreenId, layout.scaling])

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
    // press pendente: um clique = press + release quase sem movimento
    let pending: { t: number; x: number; y: number; ox: number; oy: number; handled: boolean; nodeId?: string; sfId?: string } | null = null
    function onMsg(e: MessageEvent) {
      if (!e.origin.includes("figma.com")) return
      const d = e.data
      if (!d || typeof d !== "object") return
      // Clique num hotspot do Beacon (onde o Figma não tem interação): navega o
      // protótipo, igual ao que acontece no teste. A troca de tela resultante
      // chega como PRESENTED_NODE_CHANGED e entra no caminho.
      if (d.type === "MOUSE_PRESS_OR_RELEASE") {
        const pos = d.data?.nearestScrollingFrameMousePosition ?? d.data?.targetNodeMousePosition ?? { x: 0, y: 0 }
        const off = d.data?.nearestScrollingFrameOffset ?? { x: 0, y: 0 }
        const tNow = performance.now()
        if (pending && tNow - pending.t < 700) {
          const p = pending
          pending = null
          if (Math.abs(pos.x - p.x) > 14 || Math.abs(pos.y - p.y) > 14) return // arraste
          const m = mapsRef.current
          const scr = p.nodeId ? m.screenByNode[p.nodeId] : undefined
          if (!scr || !p.nodeId || p.handled) return
          const origin = p.sfId ? m.scrollFrameGeomByScreen[p.nodeId]?.[p.sfId] : undefined
          const hit = hotspotAt(
            clickContentPoint({ vx: p.x, vy: p.y, ox: p.ox, oy: p.oy }, scr, origin),
            m.hotspotsByNode[p.nodeId]
          )
          if (hit) runEmbedHotspotAction(iframeRef.current, hit)
        } else {
          pending = {
            t: tNow,
            x: pos.x ?? 0,
            y: pos.y ?? 0,
            ox: off.x ?? 0,
            oy: off.y ?? 0,
            handled: d.data?.handled !== false,
            nodeId: d.data?.presentedNodeId,
            sfId: d.data?.nearestScrollingFrameId,
          }
        }
        return
      }
      if (d.type !== "PRESENTED_NODE_CHANGED") return
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
            {/* mobile: quadro de celular (altura fixa). Web/tablet: ocupa a
                largura disponível, na proporção do frame, limitado em altura. */}
            <div
              className={cn(
                "relative bg-white overflow-hidden shadow-sm max-w-full",
                deviceType === "mobile" ? "rounded-2xl h-[520px]" : "rounded-xl"
              )}
              style={
                deviceType === "mobile"
                  ? { aspectRatio: layout.aspect }
                  : {
                      aspectRatio: layout.aspect,
                      width: `min(100%, calc(70vh * ${layout.aspect}))`,
                      maxHeight: "70vh",
                    }
              }
            >
              {embedSrc && (
                <iframe
                  ref={iframeRef}
                  title="Protótipo"
                  src={embedSrc}
                  allowFullScreen
                  // absoluto: não depende de o navegador resolver altura em %
                  // dentro de um quadro dimensionado por aspect-ratio
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
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
