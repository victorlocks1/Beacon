"use client"
import { useEffect, useRef, useState } from "react"
import { getScrollStrips, type ScrollStrip } from "@/app/(dashboard)/studies/[id]/results/scroll-actions"

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

export function Strip({ strip }: { strip: ScrollStrip }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [show, setShow] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    function draw() {
      const w = box!.clientWidth
      const h = box!.clientHeight
      if (!w || !h) return
      canvas!.width = w
      canvas!.height = h
      const ctx = canvas!.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      if (!show) return
      const radius = Math.max(14, Math.min(w, h) * 0.06)
      for (const p of strip.points) {
        const x = p.x * w
        const y = p.y * h
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
        g.addColorStop(0, "rgba(0,0,0,0.18)")
        g.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = g
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }
      const data = ctx.getImageData(0, 0, w, h)
      const d = data.data
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3]
        if (a === 0) continue
        const [r, g, b] = ramp(a / 255)
        d[i] = r
        d[i + 1] = g
        d[i + 2] = b
        d[i + 3] = Math.min(220, a * 3)
      }
      ctx.putImageData(data, 0, 0)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(box)
    return () => ro.disconnect()
  }, [strip, show])

  const aspect = strip.contentW / Math.max(1, strip.contentH)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {strip.isPage
            ? `Página inteira (scroll vertical) — ${strip.points.length} clique(s)`
            : `Conteúdo rolável desenrolado (${strip.axis === "horizontal" ? "horizontal" : strip.axis}) — ${strip.points.length} clique(s)`}
        </span>
        <button
          onClick={() => setShow((s) => !s)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {show ? "ocultar mapa" : "mostrar mapa"}
        </button>
      </div>
      <div
        ref={boxRef}
        className="relative w-full overflow-hidden rounded-lg border bg-muted"
        style={{ aspectRatio: `${aspect}` }}
      >
        {strip.pieces.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={p.url}
            alt=""
            className="absolute block"
            style={{
              left: `${(p.x / strip.contentW) * 100}%`,
              top: `${(p.y / strip.contentH) * 100}%`,
              width: `${(p.w / strip.contentW) * 100}%`,
              height: `${(p.h / strip.contentH) * 100}%`,
            }}
          />
        ))}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>
    </div>
  )
}

// Painel que carrega SOB DEMANDA as tiras roláveis (carrossel) de uma tela e mostra
// o heatmap do conteúdo escondido (cards que ficam fora do viewport ao rolar).
export function ScrollStripHeatmap({
  studyId,
  missionId,
  screenId,
}: {
  studyId: string
  missionId: string
  screenId: string
}) {
  const [strips, setStrips] = useState<ScrollStrip[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setStrips(null)
    setLoading(true)
    getScrollStrips(studyId, missionId, screenId)
      .then((r) => {
        if (!alive) return
        setStrips(r.ok ? r.strips : [])
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [studyId, missionId, screenId])

  if (loading) return <p className="text-xs text-muted-foreground">Carregando conteúdo rolável…</p>
  if (!strips || strips.length === 0) return null

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm font-medium text-on-surface">Carrossel / conteúdo escondido</p>
      <p className="text-xs text-muted-foreground -mt-2">
        O heatmap normal mostra só a parte visível. Aqui a tira aparece inteira (todos os cards),
        com os cliques posicionados no conteúdo real — inclusive o que estava escondido ao rolar.
      </p>
      {strips.map((s) => (
        <Strip key={s.figmaId} strip={s} />
      ))}
    </div>
  )
}
