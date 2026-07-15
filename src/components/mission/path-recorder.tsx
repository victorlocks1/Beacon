"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Play, Check, X, Flag } from "lucide-react"
import { type DeviceType } from "@/lib/device"
import { dedupeConsecutive } from "@/lib/path"
import { PrototypeStage, type StageScreen } from "@/components/prototype/stage"
import { SavedPaths, toSteps, type PathStepInput } from "@/components/mission/path-steps-editor"

type RecorderScreen = StageScreen & { order: number }

interface Props {
  screens: RecorderScreen[]
  startScreenId: string | null
  deviceType: DeviceType
  paths: PathStepInput[][]
  onChange: (paths: PathStepInput[][]) => void
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
  const countByName = new Map<string, number>()
  for (const s of screens) countByName.set(s.name, (countByName.get(s.name) ?? 0) + 1)
  const nameCount = (id: string) => countByName.get(screenById.get(id)?.name ?? "") ?? 0

  function startRecording() {
    if (!startScreenId) return
    setRecording([startScreenId])
  }

  function finalize() {
    if (!recording || recording.length < 2) return
    onChange([...paths, toSteps(recording)])
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
      {/* Caminhos já salvos (com toggles de opcional / qualquer do grupo) */}
      <SavedPaths paths={paths} onChange={onChange} screenName={name} nameCount={nameCount} />

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

          {/* Protótipo navegável (mesmo motor do teste) */}
          <PrototypeStage
            key={startScreenId}
            screens={screens}
            deviceType={deviceType}
            initialScreenId={startScreenId}
            onInteraction={(ev) =>
              setRecording((r) =>
                r ? dedupeConsecutive([...r, ev.topScreenId]) : r
              )
            }
          />

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
