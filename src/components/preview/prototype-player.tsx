"use client"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
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

interface Mission {
  task: string
  description: string | null
  startScreenId: string
}

interface Props {
  screens: Screen[]
  mission: Mission | null
  startScreenId?: string
  deviceType?: DeviceType
}

export function PrototypePlayer({ screens, mission, startScreenId, deviceType = "desktop" }: Props) {
  const initialId = startScreenId ?? mission?.startScreenId ?? screens[0]?.id
  const [currentScreenId, setCurrentScreenId] = useState(initialId)
  const [showMission, setShowMission] = useState(true)

  const current = screens.find((s) => s.id === currentScreenId)
  if (!current) return <p className="text-center py-10">Tela não encontrada.</p>

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

      {/* Tela atual */}
      <div className="relative mx-auto" style={{ maxWidth: deviceMaxWidth[deviceType] }}>
        <img
          src={current.imageUrl}
          alt={current.name}
          className="w-full h-auto block"
          draggable={false}
        />
        {/* Hotspot overlay */}
        <svg className="absolute inset-0 w-full h-full">
          {current.hotspots.map((hotspot) => (
            <rect
              key={hotspot.id}
              x={`${hotspot.coords.x * 100}%`}
              y={`${hotspot.coords.y * 100}%`}
              width={`${hotspot.coords.w * 100}%`}
              height={`${hotspot.coords.h * 100}%`}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={() => setCurrentScreenId(hotspot.targetScreenId)}
            />
          ))}
        </svg>
      </div>

      {/* Barra inferior de navegação */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-full px-4 py-2 shadow-md flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          Tela {current.order + 1}/{screens.length}:
        </span>
        <span className="font-medium">{current.name}</span>
        {screens.length > 1 && (
          <div className="flex gap-1 ml-2">
            {screens.map((s) => (
              <button
                key={s.id}
                onClick={() => setCurrentScreenId(s.id)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s.id === currentScreenId ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
