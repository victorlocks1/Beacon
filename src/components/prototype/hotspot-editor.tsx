"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Save, Loader2 } from "lucide-react"

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
  targetScreenId: string | null
}

interface Screen {
  id: string
  name: string
  order: number
}

type DeviceType = "desktop" | "tablet" | "mobile"

const deviceMaxWidth: Record<DeviceType, string> = {
  mobile: "390px",
  tablet: "768px",
  desktop: "1280px",
}

interface Props {
  screenId: string
  imageUrl: string
  deviceType: DeviceType
  otherScreens: Screen[]
  initialHotspots: Array<{
    id: string
    coords: unknown
    targetScreenId: string
  }>
  onSave: (
    hotspots: Array<{
      id?: string
      coords: NormalizedRect
      targetScreenId: string | null
      shape: "rect"
    }>
  ) => Promise<void>
}

export function HotspotEditor({
  imageUrl,
  deviceType,
  otherScreens,
  initialHotspots,
  onSave,
}: Props) {
  const [hotspots, setHotspots] = useState<LocalHotspot[]>(
    initialHotspots.map((h, i) => ({
      localId: `existing-${i}`,
      dbId: h.id,
      coords: h.coords as NormalizedRect,
      targetScreenId: h.targetScreenId,
    }))
  )
  const [drawing, setDrawing] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

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
        targetScreenId: h.targetScreenId,
        shape: "rect" as const,
      }))
    )
    setSaving(false)
  }

  const maxWidth = deviceMaxWidth[deviceType]

  return (
    <div className="flex gap-6 h-full">
      {/* Editor de imagem */}
      <div className="flex-1 min-w-0 overflow-auto">
        <p className="text-xs text-muted-foreground mb-2">
          Clique e arraste para criar um hotspot
        </p>
        <div
          className="relative border rounded-lg overflow-hidden bg-muted mx-auto"
          style={{ maxWidth }}
        >
          <img
            src={imageUrl}
            alt="Tela"
            className="w-full h-auto block pointer-events-none"
            draggable={false}
          />
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: drawing ? "crosshair" : "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {hotspots.map((hotspot) => (
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
                stroke={hotspot.targetScreenId ? "#3b82f6" : "#ef4444"}
                strokeWidth={selected === hotspot.localId ? 2.5 : 1.5}
                strokeDasharray={hotspot.targetScreenId ? undefined : "6 3"}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(hotspot.localId)
                }}
              />
            ))}
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
      <div className="w-64 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">
            Hotspots ({hotspots.length})
          </h3>
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
                  <span className="text-xs font-medium">
                    Hotspot {index + 1}
                  </span>
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
                <Select
                  value={hotspot.targetScreenId ?? ""}
                  onValueChange={(val) =>
                    setHotspots((prev) =>
                      prev.map((h) =>
                        h.localId === hotspot.localId
                          ? { ...h, targetScreenId: val || null }
                          : h
                      )
                    )
                  }
                  items={Object.fromEntries(
                    otherScreens.map((s) => [s.id, `Tela ${s.order + 1}: ${s.name}`])
                  )}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
