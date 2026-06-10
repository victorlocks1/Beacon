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
import { Trash2, Save, Loader2, Upload, Check } from "lucide-react"
import { deviceMaxWidth, type DeviceType, type ScrollMode } from "@/lib/device"
import { cn } from "@/lib/utils"

type ActionType = "navigate" | "open_overlay" | "close_overlay" | "back"
type OverlayPos = "bottom" | "center"
type Axis = "horizontal" | "vertical" | "both"
type RegionKind = "scroll" | "fixed"
type Mode = "hotspots" | "regions"

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
interface LocalRegion {
  localId: string
  dbId?: string
  kind: RegionKind
  coords: NormalizedRect
  axis: Axis
  imageUrl: string | null
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
const axisLabels: Record<Axis, string> = {
  horizontal: "Horizontal",
  vertical: "Vertical",
  both: "Ambos",
}
const kindLabels: Record<RegionKind, string> = {
  scroll: "Rolável (tira)",
  fixed: "Fixa (topo/rodapé)",
}
const scrollLabels: Record<ScrollMode, string> = {
  none: "Vertical (automático)",
  vertical: "Vertical (automático)",
  horizontal: "Tela inteira: horizontal",
  both: "Tela inteira: ambos",
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
  initialRegions: Array<{ id: string; kind: RegionKind; coords: unknown; axis: Axis; imageUrl: string | null }>
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
  onSaveRegions: (
    regions: Array<{ kind: RegionKind; coords: NormalizedRect; axis: Axis; imageUrl: string | null }>
  ) => Promise<void>
  onUploadStrip: (formData: FormData) => Promise<string>
  onScrollChange: (scroll: ScrollMode) => Promise<void>
}

export function HotspotEditor({
  imageUrl,
  deviceType,
  initialScroll,
  otherScreens,
  initialHotspots,
  initialRegions,
  onSave,
  onSaveRegions,
  onUploadStrip,
  onScrollChange,
}: Props) {
  const [mode, setMode] = useState<Mode>("hotspots")
  const [hotspots, setHotspots] = useState<LocalHotspot[]>(
    initialHotspots.map((h, i) => ({
      localId: `h-${i}`,
      dbId: h.id,
      coords: h.coords as NormalizedRect,
      action: h.action,
      overlayPosition: h.overlayPosition,
      targetScreenId: h.targetScreenId,
    }))
  )
  const [regions, setRegions] = useState<LocalRegion[]>(
    initialRegions.map((r, i) => ({
      localId: `r-${i}`,
      dbId: r.id,
      kind: r.kind,
      coords: r.coords as NormalizedRect,
      axis: r.axis,
      imageUrl: r.imageUrl,
    }))
  )
  const [scroll, setScroll] = useState<ScrollMode>(initialScroll)
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [, startScrollTransition] = useTransition()
  const svgRef = useRef<SVGSVGElement>(null)

  const isComplete = (h: LocalHotspot) => (needsTarget(h.action) ? !!h.targetScreenId : true)

  function patchHotspot(localId: string, partial: Partial<LocalHotspot>) {
    setHotspots((prev) => prev.map((h) => (h.localId === localId ? { ...h, ...partial } : h)))
  }
  function patchRegion(localId: string, partial: Partial<LocalRegion>) {
    setRegions((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...partial } : r)))
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
      const coords = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
      const localId = `new-${Date.now()}`
      if (mode === "hotspots") {
        setHotspots((p) => [...p, { localId, coords, action: "navigate", overlayPosition: null, targetScreenId: null }])
      } else {
        setRegions((p) => [...p, { localId, kind: "scroll", coords, axis: "horizontal", imageUrl: null }])
      }
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
    await onSaveRegions(
      regions
        .filter((r) => r.kind === "fixed" || r.imageUrl)
        .map((r) => ({
          kind: r.kind,
          coords: r.coords,
          axis: r.axis,
          imageUrl: r.kind === "fixed" ? null : r.imageUrl,
        }))
    )
    setSaving(false)
  }

  async function handleStripUpload(localId: string, file: File) {
    setUploadingId(localId)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const url = await onUploadStrip(fd)
      patchRegion(localId, { imageUrl: url })
    } finally {
      setUploadingId(null)
    }
  }

  function changeScroll(v: ScrollMode) {
    setScroll(v)
    startScrollTransition(() => onScrollChange(v))
  }

  const maxWidth = deviceMaxWidth[deviceType]
  const targetItems = Object.fromEntries(otherScreens.map((s) => [s.id, `Tela ${s.order + 1}: ${s.name}`]))

  return (
    <div className="flex gap-6 h-full">
      {/* Editor de imagem */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-xs text-muted-foreground">
            {mode === "hotspots"
              ? "Clique e arraste para criar um hotspot"
              : "Clique e arraste sobre uma faixa (rolável ou fixa)"}
          </p>
          <Select
            value={scroll}
            onValueChange={(v) => changeScroll((v as ScrollMode) ?? "none")}
            items={scrollLabels}
          >
            <SelectTrigger className="h-7 text-xs w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Vertical (automático)</SelectItem>
              <SelectItem value="horizontal">Tela inteira: horizontal</SelectItem>
              <SelectItem value="both">Tela inteira: ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative border rounded-lg overflow-hidden bg-muted mx-auto" style={{ maxWidth }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Tela" className="w-full h-auto block pointer-events-none" draggable={false} />
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Hotspots (azul) */}
            {hotspots.map((h) => {
              const complete = isComplete(h)
              return (
                <rect
                  key={h.localId}
                  x={`${h.coords.x * 100}%`}
                  y={`${h.coords.y * 100}%`}
                  width={`${h.coords.w * 100}%`}
                  height={`${h.coords.h * 100}%`}
                  fill={selected === h.localId ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.15)"}
                  stroke={complete ? "#3b82f6" : "#ef4444"}
                  strokeWidth={selected === h.localId ? 2.5 : 1.5}
                  strokeDasharray={complete ? undefined : "6 3"}
                  style={{ cursor: "pointer", pointerEvents: mode === "hotspots" ? "auto" : "none", opacity: mode === "hotspots" ? 1 : 0.4 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(h.localId)
                  }}
                />
              )
            })}
            {/* Regiões (verde) */}
            {regions.map((r) => (
              <rect
                key={r.localId}
                x={`${r.coords.x * 100}%`}
                y={`${r.coords.y * 100}%`}
                width={`${r.coords.w * 100}%`}
                height={`${r.coords.h * 100}%`}
                fill={selected === r.localId ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.15)"}
                stroke={r.kind === "fixed" || r.imageUrl ? "#10b981" : "#ef4444"}
                strokeWidth={selected === r.localId ? 2.5 : 1.5}
                strokeDasharray={r.kind === "fixed" || r.imageUrl ? undefined : "6 3"}
                style={{ cursor: "pointer", pointerEvents: mode === "regions" ? "auto" : "none", opacity: mode === "regions" ? 1 : 0.4 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(r.localId)
                }}
              />
            ))}
            {drawingRect && drawingRect.w > 0.005 && (
              <rect
                x={`${drawingRect.x * 100}%`}
                y={`${drawingRect.y * 100}%`}
                width={`${drawingRect.w * 100}%`}
                height={`${drawingRect.h * 100}%`}
                fill={mode === "hotspots" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)"}
                stroke={mode === "hotspots" ? "#3b82f6" : "#10b981"}
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
        {/* Toggle de modo */}
        <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
          {(["hotspots", "regions"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setSelected(null)
              }}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "hotspots" ? `Hotspots (${hotspots.length})` : `Regiões (${regions.length})`}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Salvar
        </Button>

        {/* Lista do modo ativo */}
        {mode === "hotspots" ? (
          hotspots.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum hotspot ainda.<br />Clique e arraste na imagem.
            </p>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {hotspots.map((h, index) => (
                <div
                  key={h.localId}
                  className={cn(
                    "border rounded-lg p-2.5 space-y-2 cursor-pointer transition-colors",
                    selected === h.localId ? "border-blue-400 bg-blue-50" : "hover:bg-muted/50"
                  )}
                  onClick={() => setSelected(h.localId)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Hotspot {index + 1}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setHotspots((p) => p.filter((x) => x.localId !== h.localId))
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <Select value={h.action} onValueChange={(v) => patchHotspot(h.localId, { action: (v as ActionType) ?? "navigate" })} items={actionLabels}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(actionLabels) as ActionType[]).map((a) => (
                        <SelectItem key={a} value={a}>{actionLabels[a]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {needsTarget(h.action) && (
                    <Select value={h.targetScreenId ?? ""} onValueChange={(val) => patchHotspot(h.localId, { targetScreenId: (val as string) || null })} items={targetItems}>
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="→ Destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherScreens.map((s) => (
                          <SelectItem key={s.id} value={s.id}>Tela {s.order + 1}: {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {h.action === "open_overlay" && (
                    <Select value={h.overlayPosition ?? "bottom"} onValueChange={(v) => patchHotspot(h.localId, { overlayPosition: (v as OverlayPos) ?? "bottom" })} items={{ bottom: "Bottom sheet", center: "Modal central" }}>
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
          )
        ) : regions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nenhuma faixa ainda.<br />Desenhe sobre uma faixa e escolha se ela rola ou fica fixa.
          </p>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1">
            {regions.map((r, index) => (
              <div
                key={r.localId}
                className={cn(
                  "border rounded-lg p-2.5 space-y-2 cursor-pointer transition-colors",
                  selected === r.localId ? "border-emerald-400 bg-emerald-50" : "hover:bg-muted/50"
                )}
                onClick={() => setSelected(r.localId)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Região {index + 1}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRegions((p) => p.filter((x) => x.localId !== r.localId))
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <Select value={r.kind} onValueChange={(v) => patchRegion(r.localId, { kind: (v as RegionKind) ?? "scroll" })} items={kindLabels}>
                  <SelectTrigger className="h-7 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(kindLabels) as RegionKind[]).map((k) => (
                      <SelectItem key={k} value={k}>{kindLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {r.kind === "fixed" ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Esta faixa fica fixa (não rola) e reaproveita a própria tela. Ideal para barras de navegação no topo ou rodapé.
                  </p>
                ) : (
                  <>
                    <Select value={r.axis} onValueChange={(v) => patchRegion(r.localId, { axis: (v as Axis) ?? "horizontal" })} items={axisLabels}>
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(axisLabels) as Axis[]).map((a) => (
                          <SelectItem key={a} value={a}>{axisLabels[a]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs cursor-pointer rounded-md border border-dashed px-2 py-1.5 hover:bg-muted/50" onClick={(e) => e.stopPropagation()}>
                      {uploadingId === r.localId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : r.imageUrl ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={r.imageUrl ? "text-emerald-700" : "text-muted-foreground"}>
                        {r.imageUrl ? "Tira enviada — trocar" : "Subir tira completa"}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handleStripUpload(r.localId, f)
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
