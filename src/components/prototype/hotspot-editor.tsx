"use client"
import { useState, useRef, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Save, Loader2 } from "lucide-react"
import { deviceMaxWidth, type DeviceType, type ScrollMode } from "@/lib/device"

type ActionType = "navigate" | "open_overlay" | "close_overlay" | "back"
type OverlayPos = "bottom" | "center"

interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

interface LocalHotspot {
  localId: string
  dbId?: string
  coords: NormalizedRect
  action: ActionType
  overlayPosition: OverlayPos | null
  targetScreenId: string | null
}

interface Screen {
  id: string
  name: string
  order: number
}

const actionLabels: Record<ActionType, string> = {
  navigate: "Navegar",
  open_overlay: "Abrir overlay",
  close_overlay: "Fechar overlay",
  back: "Voltar",
}
const needsTarget = (a: ActionType) => a === "navigate" || a === "open_overlay"

const scrollLabels: Record<ScrollMode, string> = {
  none: "Sem scroll",
  vertical: "Scroll vertical",
  horizontal: "Scroll horizontal",
  both: "Scroll ambos",
}

interface Props {
  screenId: string
  imageUrl: string
  deviceType: DeviceType
  initialScroll: ScrollMode
  otherScreens: Screen[]
  initialHotspots: Array<{
    id: string
    coords: unknown
    action: ActionType
    overlayPosition: OverlayPos | null
    targetScreenId: string | null
  }>
  onSave: (
    hotspots: Array<{
      id?: string
      coords: NormalizedRect
      action: ActionType
      overlayPosition: OverlayPos | null
      targetScreenId: string | null
      shape: "rect"
    }>
  ) => Promise<void>
  onScrollChange: (scroll: ScrollMode) => Promise<void>
}

export function HotspotEditor({
  imageUrl,
  deviceType,
  initialScroll,
  otherScreens,
  initialHotspots,
  onSave,
  onScrollChange,
}: Props) {
  const [hotspots, setHotspots] = useState<LocalHotspot[]>(
    initialHotspots.map((h, i) => ({
      localId: `existing-${i}`,
      dbId: h.id,
      coords: h.coords as NormalizedRect,
      action: h.action,
      overlayPosition: h.overlayPosition,
      targetScreenId: h.targetScreenId,
    }))
  )
  const [scroll, setScroll] = useState<ScrollMode>(initialScroll)
  const [drawing, setDrawing] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [, startScrollTransition] = useTransition()
  const svgRef = useRef<SVGSVGElement>(null)

  function isComplete(h: LocalHotspot) {
    return needsTarget(h.action) ? !!h.targetScreenId : true
  }

  function patch(localId: string, partial: Partial<LocalHotspot>) {
    setHotspots((prev) =>
      prev.map((h) => (h.localId === localId ? { ...h, ...partial } : h))
    )
  }

  function getRelativePos(e: React.MouseEvent) {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as SVGElement).tagName === "rect") return
    e.preventDefault()
    const { x, y } = getRelativePos(e)
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y })
    setSelected(null)
  }
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawing) return
    const { x, y } = getRelativePos(e)
    setDrawing((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null))
  }
  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawing) return
    const { x, y } = getRelativePos(e)
    const minX = Math.min(drawing.startX, x)
    const maxX = Math.max(drawing.startX, x)
    const minY = Math.min(drawing.startY, y)
    const maxY = Math.max(drawing.startY, y)
    if (maxX - minX > 0.02 && maxY - minY > 0.02) {
      const localId = `new-${Date.now()}`
      setHotspots((prev) => [
        ...prev,
        {
          localId,
          coords: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          action: "navigate",
          overlayPosition: null,
          targetScreenId: null,
        },
      ])
      setSelected(localId)
    }
    setDrawing(null)
  }

  const drawingRect = drawing
    ? {
        x: Math.min(drawing.startX, drawing.currentX),
        y: Math.min(drawing.startY, drawing.currentY),
        w: Math.abs(drawing.currentX - drawing.startX),
        h: Math.abs(drawing.currentY - drawing.startY),
      }
    : null

  async function handleSave() {
    setSaving(true)
    await onSave(
      hotspots.map((h) => ({
        id: h.dbId,
        coords: h.coords,
        action: h.action,
        overlayPosition: h.action === "open_overlay" ? (h.overlayPosition ?? "bottom") : null,
        targetScreenId: needsTarget(h.action) ? h.targetScreenId : null,
        shape: "rect" as const,
      }))
    )
    setSaving(false)
  }

  function changeScroll(v: ScrollMode) {
    setScroll(v)
    startScrollTransition(() => onScrollChange(v))
  }

  const maxWidth = deviceMaxWidth[deviceType]
  const targetItems = Object.fromEntries(
    otherScreens.map((s) => [s.id, `Tela ${s.order + 1}: ${s.name}`])
  )

  return (
    <div className="flex gap-6 h-full">
      {/* Editor de imagem */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-xs text-muted-foreground">
            Clique e arraste para criar um hotspot
          </p>
          {/* Scroll desta tela */}
          <Select
            value={scroll}
            onValueChange={(v) => changeScroll((v as ScrollMode) ?? "none")}
            items={scrollLabels}
          >
            <SelectTrigger className="h-7 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(scrollLabels) as ScrollMode[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {scrollLabels[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          className="relative border rounded-lg overflow-hidden bg-muted mx-auto"
          style={{ maxWidth }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Tela"
            className="w-full h-auto block pointer-events-none"
            draggable={false}
          />
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {hotspots.map((hotspot) => {
              const complete = isComplete(hotspot)
              return (
                <rect
                  key={hotspot.localId}
                  x={`${hotspot.coords.x * 100}%`}
                  y={`${hotspot.coords.y * 100}%`}
                  width={`${hotspot.coords.w * 100}%`}
                  height={`${hotspot.coords.h * 100}%`}
                  fill={
                    selected === hotspot.localId
                      ? "rgba(59,130,246,0.3)"
                      : "rgba(59,130,246,0.15)"
                  }
                  stroke={complete ? "#3b82f6" : "#ef4444"}
                  strokeWidth={selected === hotspot.localId ? 2.5 : 1.5}
                  strokeDasharray={complete ? undefined : "6 3"}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(hotspot.localId)
                  }}
                />
              )
            })}
            {drawingRect && drawingRect.w > 0.005 && (
              <rect
                x={`${drawingRect.x * 100}%`}
                y={`${drawingRect.y * 100}%`}
                width={`${drawingRect.w * 100}%`}
                height={`${drawingRect.h * 100}%`}
                fill="rgba(59,130,246,0.15)"
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>
        </div>
      </div>

      {/* Painel lateral */}
      <div className="w-72 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Hotspots ({hotspots.length})</h3>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Salvar
          </Button>
        </div>

        {hotspots.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nenhum hotspot ainda.
            <br />
            Clique e arraste na imagem.
          </p>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1">
            {hotspots.map((hotspot, index) => (
              <div
                key={hotspot.localId}
                className={`border rounded-lg p-2.5 space-y-2 cursor-pointer transition-colors ${
                  selected === hotspot.localId
                    ? "border-blue-400 bg-blue-50"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setSelected(hotspot.localId)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Hotspot {index + 1}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setHotspots((prev) =>
                        prev.filter((h) => h.localId !== hotspot.localId)
                      )
                      if (selected === hotspot.localId) setSelected(null)
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* Tipo de ação */}
                <Select
                  value={hotspot.action}
                  onValueChange={(v) =>
                    patch(hotspot.localId, { action: (v as ActionType) ?? "navigate" })
                  }
                  items={actionLabels}
                >
                  <SelectTrigger className="h-7 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(actionLabels) as ActionType[]).map((a) => (
                      <SelectItem key={a} value={a}>
                        {actionLabels[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Destino (navegar / abrir overlay) */}
                {needsTarget(hotspot.action) && (
                  <Select
                    value={hotspot.targetScreenId ?? ""}
                    onValueChange={(val) =>
                      patch(hotspot.localId, { targetScreenId: (val as string) || null })
                    }
                    items={targetItems}
                  >
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="→ Destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherScreens.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Tela {s.order + 1}: {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Posição do overlay */}
                {hotspot.action === "open_overlay" && (
                  <Select
                    value={hotspot.overlayPosition ?? "bottom"}
                    onValueChange={(v) =>
                      patch(hotspot.localId, { overlayPosition: (v as OverlayPos) ?? "bottom" })
                    }
                    items={{ bottom: "Bottom sheet", center: "Modal central" }}
                  >
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom">Bottom sheet</SelectItem>
                      <SelectItem value="center">Modal central</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
