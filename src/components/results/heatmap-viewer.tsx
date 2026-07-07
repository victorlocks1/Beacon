"use client"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { deviceMaxWidth, type DeviceType } from "@/lib/device"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Point {
  x: number
  y: number
  type: "click" | "misclick"
}
interface ScreenData {
  id: string
  name: string
  order: number
  imageUrl: string
  points: Point[]
  firstClickPoints?: Point[] // primeiro toque de cada participante (modo "first click")
}

type Mode = "heatmap" | "clicks" | "firstclick" | "image"

function ramp(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [0, 0, 255],
    [0, 255, 255],
    [0, 255, 0],
    [255, 255, 0],
    [255, 0, 0],
  ]
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1)
  const i = Math.floor(x)
  const f = x - i
  const a = stops[i]
  const b = stops[i + 1]
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]
}

export function HeatmapViewer({
  screens,
  deviceType,
}: {
  screens: ScreenData[]
  deviceType: DeviceType
}) {
  const [selectedId, setSelectedId] = useState(screens[0]?.id)
  const [mode, setMode] = useState<Mode>("heatmap")
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const screen = screens.find((s) => s.id === selectedId) ?? screens[0]
  // pontos ativos conforme o modo (todos os cliques × primeiro toque)
  const activePoints =
    mode === "firstclick" ? screen?.firstClickPoints ?? [] : screen?.points ?? []

  useEffect(() => {
    if ((mode !== "heatmap" && mode !== "firstclick") || !screen) return
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    const pts = mode === "firstclick" ? screen.firstClickPoints ?? [] : screen.points

    function draw() {
      const w = img!.clientWidth
      const h = img!.clientHeight
      if (!w || !h) return
      canvas!.width = w
      canvas!.height = h
      const ctx = canvas!.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      const radius = Math.max(18, w * 0.05)
      for (const p of pts) {
        const x = p.x * w
        const y = p.y * h
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
        g.addColorStop(0, "rgba(0,0,0,0.16)")
        g.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = g
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }

      const imgData = ctx.getImageData(0, 0, w, h)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3]
        if (a === 0) continue
        const [r, g, b] = ramp(a / 255)
        d[i] = r
        d[i + 1] = g
        d[i + 2] = b
        d[i + 3] = Math.min(220, a * 3)
      }
      ctx.putImageData(imgData, 0, 0)
    }

    if (img.complete) draw()
    else img.onload = draw

    const ro = new ResizeObserver(draw)
    ro.observe(img)
    return () => ro.disconnect()
  }, [mode, screen])

  if (!screen) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum clique registrado ainda.
      </p>
    )
  }

  const clickCount = screen.points.filter((p) => p.type === "click").length
  const misclickCount = screen.points.filter((p) => p.type === "misclick").length
  const firstClickCount = (screen.firstClickPoints ?? []).length

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Seletor de tela */}
        <Select
          value={selectedId}
          onValueChange={(v) => setSelectedId((v as string) ?? selectedId)}
          items={Object.fromEntries(
            screens.map((s) => [s.id, `Tela ${s.order + 1}: ${s.name}`])
          )}
        >
          <SelectTrigger className="h-10 rounded-lg min-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {screens.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                Tela {s.order + 1}: {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle de modo */}
        <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
          {(["heatmap", "clicks", "firstclick", "image"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "heatmap"
                ? "Heatmap"
                : m === "clicks"
                  ? "Clicks"
                  : m === "firstclick"
                    ? "First click"
                    : "Imagem"}
            </button>
          ))}
        </div>
      </div>

      {/* Imagem + overlay */}
      <div
        className="relative mx-auto border rounded-lg overflow-hidden bg-muted"
        style={{ maxWidth: deviceMaxWidth[deviceType] }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={screen.imageUrl}
          alt={screen.name}
          className="w-full h-auto block"
        />

        {(mode === "heatmap" || mode === "firstclick") && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}

        {mode === "clicks" && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {screen.points.map((p, i) => (
              <circle
                key={i}
                cx={`${p.x * 100}%`}
                cy={`${p.y * 100}%`}
                r={6}
                fill={p.type === "misclick" ? "rgba(239,68,68,0.5)" : "rgba(59,130,246,0.5)"}
                stroke={p.type === "misclick" ? "#ef4444" : "#3b82f6"}
                strokeWidth={1}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {mode === "firstclick" ? (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            {firstClickCount} primeiro(s) clique(s)
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              {clickCount} clique(s) em hotspot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              {misclickCount} misclick(s)
            </span>
          </>
        )}
      </div>
    </div>
  )
}
