"use client"
import { useState } from "react"
import { ClipboardList } from "lucide-react"
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
  const [topScreenId, setTopScreenId] = useState(initialId)

  const current = screens.find((s) => s.id === topScreenId)
  if (!screens.length) return <p className="text-center py-10">Sem telas.</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 select-none rounded-3xl overflow-hidden border border-outline-variant">
      {/* Metade esquerda: a tarefa (sem card) */}
      <div className="flex flex-col justify-center px-6 py-10 md:px-10 lg:px-12 bg-surface min-h-[70vh]">
        {mission ? (
          <div className="w-full max-w-md md:ml-auto md:mr-6 space-y-6">
            <div className="flex items-center gap-2 text-label-large text-on-surface-variant">
              <ClipboardList className="h-4 w-4" />
              Missão
            </div>
            <div className="space-y-3">
              <h2 className="text-headline-medium text-on-surface">{mission.task}</h2>
              {mission.description && (
                <p className="text-body-large text-on-surface-variant">
                  {mission.description}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-body-medium text-on-surface-variant text-center">
            Nenhuma missão para exibir.
          </p>
        )}
      </div>

      {/* Metade direita: protótipo navegável */}
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 md:px-10 bg-surface-container overflow-auto min-h-[70vh]">
        <PrototypeStage
          screens={screens}
          deviceType={deviceType}
          initialScreenId={initialId}
          onInteraction={(ev) => setTopScreenId(ev.topScreenId)}
        />

        {/* Indicador da tela atual */}
        <div className="bg-surface-container-low border border-outline-variant rounded-full px-4 py-2 elevation-1 flex items-center gap-2 text-body-small">
          <span className="text-on-surface-variant">Tela:</span>
          <span className="font-medium text-on-surface">{current?.name ?? "—"}</span>
        </div>
      </div>
    </div>
  )
}
