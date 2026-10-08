"use client"
import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deviceMaxWidth, type DeviceType } from "@/lib/device"
import { Check } from "lucide-react"

interface PickerScreen {
  id: string
  name: string
  order: number
  imageUrl: string
  width: number
  height: number
  hotspots: { id: string; coords: { x: number; y: number; w: number; h: number } }[]
}

interface Props {
  screens: PickerScreen[]
  startScreenId: string | null
  deviceType: DeviceType
  value: string[] // ids dos hotspots que contam como sucesso
  onChange: (ids: string[]) => void
}

// Escolhe, clicando sobre a tela, quais hotspots contam como SUCESSO da tarefa.
// Clicar em qualquer um dos marcados conclui a missão.
export function HotspotGoalPicker({ screens, startScreenId, deviceType, value, onChange }: Props) {
  const withHotspots = screens.filter((s) => s.hotspots.length > 0)
  const selected = new Set(value)
  const countOn = (s: PickerScreen) => s.hotspots.filter((h) => selected.has(h.id)).length

  // abre na tela que já tem hotspot marcado; senão na inicial; senão na primeira
  const [screenId, setScreenId] = useState<string>(
    () =>
      (
        withHotspots.find((s) => countOn(s) > 0) ??
        withHotspots.find((s) => s.id === startScreenId) ??
        withHotspots[0]
      )?.id ?? ""
  )
  const screen = withHotspots.find((s) => s.id === screenId) ?? withHotspots[0]

  if (!screen) {
    return (
      <p className="text-sm text-muted-foreground border-2 border-dashed rounded-lg p-4 text-center">
        Nenhuma tela tem hotspots ainda. Abra a aba <strong>Protótipo</strong>, clique em{" "}
        <strong>Hotspots</strong> na tela desejada e desenhe as áreas clicáveis.
      </p>
    )
  }

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const label = (s: PickerScreen) => {
    const n = countOn(s)
    return `Tela ${s.order + 1}: ${s.name}${n ? ` · ${n} marcado(s)` : ""}`
  }

  return (
    <div className="space-y-3">
      <Select
        value={screen.id}
        onValueChange={(v) => setScreenId((v as string) ?? "")}
        items={Object.fromEntries(withHotspots.map((s) => [s.id, label(s)]))}
      >
        <SelectTrigger className="w-full h-14 rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top">
          {withHotspots.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {label(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-body-small text-on-surface-variant">
        Clique nos hotspots que contam como sucesso. Com mais de um marcado, clicar em{" "}
        <strong className="text-on-surface font-medium">qualquer um</strong> conclui a tarefa.
      </p>

      <div className="max-h-[60vh] overflow-auto rounded-lg border bg-muted">
        <div
          className="relative mx-auto"
          style={{
            maxWidth: deviceMaxWidth[deviceType],
            // sem imagem (tela do Figma ainda não baixada): mantém a proporção
            aspectRatio: screen.imageUrl ? undefined : `${screen.width} / ${screen.height}`,
          }}
        >
          {screen.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={screen.imageUrl} alt={screen.name} className="w-full h-auto block" draggable={false} />
          )}
          <svg className="absolute inset-0 w-full h-full">
            {screen.hotspots.map((h) => {
              const on = selected.has(h.id)
              return (
                <rect
                  key={h.id}
                  x={`${h.coords.x * 100}%`}
                  y={`${h.coords.y * 100}%`}
                  width={`${h.coords.w * 100}%`}
                  height={`${h.coords.h * 100}%`}
                  fill={on ? "rgba(16,185,129,0.35)" : "rgba(59,130,246,0.15)"}
                  stroke={on ? "#059669" : "#3b82f6"}
                  strokeWidth={on ? 2.5 : 1.5}
                  strokeDasharray={on ? undefined : "6 3"}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggle(h.id)}
                />
              )
            })}
          </svg>
        </div>
      </div>

      {value.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-green-600">
          <Check className="h-3.5 w-3.5" />
          {value.length} hotspot(s) de sucesso
        </p>
      )}
    </div>
  )
}
