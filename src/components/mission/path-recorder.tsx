"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Play, Check, X, Trash2, Flag } from "lucide-react"
import { deviceMaxWidth, type DeviceType } from "@/lib/device"

interface Hotspot {
  id: string
  coords: { x: number; y: number; w: number; h: number }
  targetScreenId: string
}
interface Screen {
  id: string
  name: string
  order: number
  imageUrl: string
  hotspots: Hotspot[]
}

interface Props {
  screens: Screen[]
  startScreenId: string | null
  deviceType: DeviceType
  paths: string[][]
  onChange: (paths: string[][]) => void
}

export function PathRecorder({
  screens,
  startScreenId,
  deviceType,
  paths,
  onChange,
}: Props) {
  const [recording, setRecording] = useState<string[] | null>(null)
  const screenById = new Map(screens.map((s) => [s.id, s]))

  const currentScreenId = recording?.[recording.length - 1] ?? null
  const currentScreen = currentScreenId ? screenById.get(currentScreenId) : null

  function startRecording() {
    if (!startScreenId) return
    setRecording([startScreenId])
  }

  function handleHotspotClick(targetScreenId: string) {
    if (!recording) return
    setRecording([...recording, targetScreenId])
  }

  function finalize() {
    if (!recording || recording.length < 2) return
    onChange([...paths, recording])
    setRecording(null)
  }

  function name(id: string) {
    const s = screenById.get(id)
    return s ? `${s.order + 1}. ${s.name}` : "?"
  }

  if (!startScreenId) {
    return (
      <p className="text-sm text-muted-foreground border-2 border-dashed rounded-lg p-4 text-center">
        Selecione a tela inicial acima para gravar o caminho esperado.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Caminhos já salvos */}
      {paths.length > 0 && (
        <div className="space-y-2">
          {paths.map((path, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 border rounded-lg p-2.5 bg-muted/30"
            >
              <div className="flex items-center gap-1 flex-wrap text-xs">
                <span className="font-medium mr-1">Caminho {i + 1}:</span>
                {path.map((sid, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-background border">
                      {name(sid)}
                    </span>
                    {idx < path.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onChange(paths.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Gravação ativa */}
      {recording ? (
        <div className="space-y-3 border rounded-xl p-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 flex-wrap text-xs">
            <span className="font-medium mr-1">Gravando:</span>
            {recording.map((sid, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded border",
                    idx === recording.length - 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {name(sid)}
                </span>
                {idx < recording.length - 1 && (
                  <span className="text-muted-foreground">→</span>
                )}
              </span>
            ))}
          </div>

          {/* Tela atual navegável */}
          {currentScreen && (
            <div
              className="relative mx-auto border rounded-lg overflow-hidden bg-muted"
              style={{ maxWidth: deviceMaxWidth[deviceType] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentScreen.imageUrl}
                alt={currentScreen.name}
                className="w-full h-auto block pointer-events-none select-none"
                draggable={false}
              />
              <svg className="absolute inset-0 w-full h-full">
                {currentScreen.hotspots.map((h) => (
                  <rect
                    key={h.id}
                    x={`${h.coords.x * 100}%`}
                    y={`${h.coords.y * 100}%`}
                    width={`${h.coords.w * 100}%`}
                    height={`${h.coords.h * 100}%`}
                    fill="rgba(59,130,246,0.18)"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleHotspotClick(h.targetScreenId)}
                  />
                ))}
              </svg>
            </div>
          )}

          {currentScreen && currentScreen.hotspots.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Esta tela não tem hotspots. Finalize o caminho ou cancele.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={finalize}
              disabled={recording.length < 2}
            >
              <Flag className="h-3.5 w-3.5 mr-1.5" />
              Finalizar caminho ({recording.length} telas)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRecording(null)}
            >
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
