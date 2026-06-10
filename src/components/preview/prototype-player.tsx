"use client"
import { useState } from "react"
import { ClipboardList, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
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
  const [collapsed, setCollapsed] = useState(false)
  const [topScreenId, setTopScreenId] = useState(initialId)

  const current = screens.find((s) => s.id === topScreenId)
  if (!screens.length) return <p className="text-center py-10">Sem telas.</p>

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-6 select-none">
      {/* Esquerda: missão (não recolhe ao clicar; só no botão) */}
      {mission && (
        <aside className="w-full md:w-80 shrink-0 md:sticky md:top-6">
          <div className="rounded-3xl bg-surface-container-low border border-outline-variant p-6">
            {/* Cabeçalho (sempre visível) */}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-label-large text-on-surface-variant">
                <ClipboardList className="h-4 w-4" />
                Missão
              </span>
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high",
                  collapsed ? "px-3 py-1.5 text-title-small text-primary" : "p-1.5"
                )}
                title={collapsed ? "Ver tarefa" : "Ocultar"}
              >
                {collapsed ? (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Ver tarefa
                  </>
                ) : (
                  <ChevronUp className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Corpo (encolhe pra cima) */}
            {!collapsed && (
              <div className="space-y-2 mt-4">
                <h2 className="text-title-large text-on-surface">{mission.task}</h2>
                {mission.description && (
                  <p className="text-body-medium text-on-surface-variant">
                    {mission.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Direita: protótipo navegável */}
      <div className="flex-1 flex flex-col items-center w-full gap-4">
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
