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
import { Strip } from "@/components/results/scroll-strip-heatmap"
import {
  getScrollStrips,
  getOverlayPoints,
  type ScrollStrip,
  type OverlayPoint,
} from "@/app/(dashboard)/studies/[id]/results/scroll-actions"

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
  isOverlay?: boolean // bottomsheet/modal: usa pontos fiéis (via elemento) sob demanda
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
  studyId,
  missionId,
}: {
  screens: ScreenData[]
  deviceType: DeviceType
  studyId?: string // + missionId → mostra o painel de carrossel/conteúdo escondido
  missionId?: string
}) {
  const [selectedId, setSelectedId] = useState(screens[0]?.id)
  const [mode, setMode] = useState<Mode>("heatmap")
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const screen = screens.find((s) => s.id === selectedId) ?? screens[0]
  // pontos ativos conforme o modo (todos os cliques × primeiro toque)
  const activePoints =
    mode === "firstclick" ? screen?.firstClickPoints ?? [] : screen?.points ?? []

  // Tiras roláveis (carrossel + scroll de página) da tela selecionada, sob demanda.
  const [strips, setStrips] = useState<ScrollStrip[] | null>(null)
  useEffect(() => {
    if (!studyId || !missionId || !screen) {
      setStrips(null)
      return
    }
    let alive = true
    setStrips(null)
    getScrollStrips(studyId, missionId, screen.id).then((r) => {
      if (alive) setStrips(r.ok ? r.strips : [])
    })
    return () => {
      alive = false
    }
  }, [studyId, missionId, screen])
  // Visão de PÁGINA INTEIRA (scroll vertical) DESATIVADA: a reconstrução em
  // pedaços distorcia os carrosséis internos (cards espremidos/ilegíveis). O
  // heatmap principal volta a ser o print do viewport (legível). Os carrosséis/
  // filtros seguem nas tiras horizontais, e as overlays no heatmap fiel.
  const pageStrip: ScrollStrip | null = null
  const nestedStrips = strips?.filter((s) => !s.isPage) ?? []

  // OVERLAY (bottomsheet/modal): pontos FIÉIS via geometria do elemento, sob
  // demanda. Substituem os pontos gravados (que caem no lugar errado em overlay).
  const [overlayPoints, setOverlayPoints] = useState<OverlayPoint[] | null>(null)
  useEffect(() => {
    if (!studyId || !missionId || !screen?.isOverlay) {
      setOverlayPoints(null)
      return
    }
    let alive = true
    setOverlayPoints(null)
    getOverlayPoints(studyId, missionId, screen.id).then((r) => {
      if (alive) setOverlayPoints(r.ok ? r.points : null)
    })
    return () => {
      alive = false
    }
  }, [studyId, missionId, screen])
  const overlayReady = !!screen?.isOverlay && overlayPoints != null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Limpa SEMPRE ao (re)entrar — evita que o heatmap da tela anterior fique
    // "preso" no canvas ao trocar/voltar de tela (imagem em cache).
    const ctx0 = canvas.getContext("2d")
    if (ctx0) ctx0.clearRect(0, 0, canvas.width, canvas.height)

    if ((mode !== "heatmap" && mode !== "firstclick") || !screen) return
    const img = imgRef.current
    if (!img) return
    // overlay usa os pontos fiéis (via elemento); senão os gravados
    const pts = overlayReady
      ? overlayPoints!
      : mode === "firstclick"
        ? screen.firstClickPoints ?? []
        : screen.points

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

    // Só desenha com a imagem REALMENTE carregada (dimensões corretas). Caso
    // contrário, aguarda o onload — e o handler é limpo no cleanup para nunca
    // disparar um desenho defasado depois de trocar de tela.
    if (img.complete && img.naturalWidth > 0) draw()
    else img.onload = draw

    const ro = new ResizeObserver(draw)
    ro.observe(img)
    return () => {
      ro.disconnect()
      img.onload = null
    }
  }, [mode, screen, overlayReady, overlayPoints])

  if (!screen) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum clique registrado ainda.
      </p>
    )
  }

  // contagens: overlay usa os pontos fiéis; senão os gravados
  const basePoints = overlayReady ? overlayPoints! : screen.points
  const clickCount = basePoints.filter((p) => p.type === "click").length
  const misclickCount = basePoints.filter((p) => p.type === "misclick").length
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

        {/* Toggle de modo (não se aplica à visão de página inteira) */}
        {!pageStrip && (
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
        )}
      </div>

      {/* Heatmap principal: PÁGINA INTEIRA quando a tela rola verticalmente
          (mostra tudo, inclusive abaixo do fold, com cliques na posição real);
          senão, o viewport normal (imagem + overlay). */}
      {pageStrip ? (
        <div className="mx-auto" style={{ maxWidth: deviceMaxWidth[deviceType] }}>
          <Strip strip={pageStrip} />
        </div>
      ) : (
        <div
          className="relative mx-auto border rounded-lg overflow-hidden bg-muted"
          style={{ maxWidth: deviceMaxWidth[deviceType] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={screen.id}
            ref={imgRef}
            src={screen.imageUrl}
            alt={screen.name}
            className="w-full h-auto block"
          />

          {(mode === "heatmap" || mode === "firstclick") && (
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          )}

          {mode === "clicks" && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {basePoints.map((p, i) => (
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
      )}

      {/* Carrosséis / conteúdo escondido aninhado (barras de filtro, carrosséis) */}
      {nestedStrips.length > 0 && (
        <div className="space-y-4 pt-2">
          <p className="text-sm font-medium text-on-surface">Carrossel / conteúdo escondido</p>
          <p className="text-xs text-muted-foreground -mt-2">
            Além da parte visível, estas tiras aparecem inteiras (todos os cards/filtros), com os
            cliques no conteúdo real — inclusive o que ficava escondido ao rolar.
          </p>
          {nestedStrips.map((s) => (
            <Strip key={s.figmaId} strip={s} />
          ))}
        </div>
      )}

      {/* Legenda (só na visão de viewport; a de página tem contagem própria) */}
      {!pageStrip && (
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
      )}
    </div>
  )
}
