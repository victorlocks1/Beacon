"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Eye, EyeOff, GripVertical, Flag } from "lucide-react"

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const MARGIN = 8 // margem mínima da borda da tela

// Widget flutuante da tarefa (estilo Maze), usado no fluxo WEB: o protótipo fica
// em tela cheia e a instrução vira este cartão sobreposto e ARRASTÁVEL, pra não
// atrapalhar a interface. Recolhido = pill com "Mostrar instruções" + "Desistir".
// Expandido = mostra o enunciado da tarefa (animado) e vira "Ocultar instruções".
export function FloatingTaskWidget({
  stepLabel,
  title,
  description,
  showLabel,
  hideLabel,
  giveUpLabel,
  onGiveUp,
  defaultExpanded = false,
}: {
  stepLabel: string
  title: string
  description?: string | null
  showLabel: string
  hideLabel: string
  giveUpLabel: string
  onGiveUp: () => void
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  // pos null = ainda no lugar padrão (embaixo/centro via CSS); ao arrastar vira {x,y}.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)

  const onPointerMove = useCallback((e: PointerEvent) => {
    const el = ref.current
    const ds = dragRef.current
    if (!el || !ds) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const x = clamp(e.clientX - ds.offsetX, MARGIN, window.innerWidth - w - MARGIN)
    const y = clamp(e.clientY - ds.offsetY, MARGIN, window.innerHeight - h - MARGIN)
    setPos({ x, y })
  }, [])

  const onPointerUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
  }, [onPointerMove])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      dragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
      // fixa a posição atual (sai do lugar padrão de CSS) antes de mover
      setPos({ x: rect.left, y: rect.top })
      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", onPointerUp)
      e.preventDefault()
    },
    [onPointerMove, onPointerUp]
  )

  // mantém dentro da tela ao redimensionar a janela
  useEffect(() => {
    function onResize() {
      const el = ref.current
      if (!el) return
      setPos((p) =>
        p
          ? {
              x: clamp(p.x, MARGIN, window.innerWidth - el.offsetWidth - MARGIN),
              y: clamp(p.y, MARGIN, window.innerHeight - el.offsetHeight - MARGIN),
            }
          : p
      )
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const positioned = pos != null

  return (
    <div
      ref={ref}
      className={
        "fixed z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl bg-surface-container-low border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.18)] select-none " +
        (positioned ? "" : "left-1/2 -translate-x-1/2 bottom-6")
      }
      style={positioned ? { left: pos!.x, top: pos!.y } : undefined}
    >
      {/* Instruções — abre/fecha animado (truque grid-rows 0fr↔1fr) */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="max-h-[45vh] overflow-y-auto p-4 pb-3 subtle-scroll">
            <div className="text-label-large text-on-surface-variant mb-1.5">{stepLabel}</div>
            <h2 className="text-title-medium font-semibold text-on-surface">{title}</h2>
            {description && (
              <p className="mt-1.5 whitespace-pre-wrap text-body-medium text-on-surface-variant">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Barra de controle (sempre visível) */}
      <div className="flex items-center gap-1 p-1.5">
        <button
          type="button"
          onPointerDown={onPointerDown}
          aria-label="Mover"
          className="flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 text-label-large text-on-surface hover:bg-surface-container-high"
        >
          {expanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {expanded ? hideLabel : showLabel}
        </button>
        <button
          type="button"
          onClick={onGiveUp}
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-label-large text-on-surface-variant hover:bg-surface-container-high"
        >
          <Flag className="h-4 w-4" />
          {giveUpLabel}
        </button>
      </div>
    </div>
  )
}
