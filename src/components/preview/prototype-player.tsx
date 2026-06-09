"use client"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { type DeviceType } from "@/lib/device"
import { PrototypeStage, type StageScreen } from "@/components/prototype/stage"

interface Mission {
  task: string
  description: string | null
  startScreenId: string
}

interface Props {
  screens: StageScreen[]
  mission: Mission | null
  startScreenId?: string
  deviceType?: DeviceType
}

export function PrototypePlayer({
  screens,
  mission,
  startScreenId,
  deviceType = "desktop",
}: Props) {
  const initialId = startScreenId ?? mission?.startScreenId ?? screens[0]?.id
  const [showMission, setShowMission] = useState(true)
  const [topScreenId, setTopScreenId] = useState(initialId)

  const current = screens.find((s) => s.id === topScreenId)
  if (!screens.length) return <p className="text-center py-10">Sem telas.</p>

  return (
    <div className="relative select-none">
      {/* Missão flutuante */}
      {mission && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-xs bg-white border rounded-xl shadow-lg transition-all ${
            showMission ? "p-4" : "p-2"
          }`}
        >
          {showMission ? (
            <>
              <div className="flex items-start justify-between gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">
                  Missão
                </Badge>
                <button
                  onClick={() => setShowMission(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Ocultar
                </button>
              </div>
              <p className="font-semibold text-sm">{mission.task}</p>
              {mission.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {mission.description}
                </p>
              )}
            </>
          ) : (
            <button
              onClick={() => setShowMission(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ver missão
            </button>
          )}
        </div>
      )}

      {/* Protótipo navegável */}
      <PrototypeStage
        screens={screens}
        deviceType={deviceType}
        initialScreenId={initialId}
        onInteraction={(ev) => setTopScreenId(ev.topScreenId)}
      />

      {/* Barra inferior */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-full px-4 py-2 shadow-md flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Tela:</span>
        <span className="font-medium">{current?.name ?? "—"}</span>
      </div>
    </div>
  )
}
