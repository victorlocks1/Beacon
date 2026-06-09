"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ClipboardList, Flag, GripHorizontal, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { type DeviceType } from "@/lib/device"
import { dedupeConsecutive } from "@/lib/path"
import { PrototypeStage, type StageScreen, type StageInteraction } from "@/components/prototype/stage"

interface Mission {
  id: string
  task: string
  description: string | null
  startScreenId: string
  goalScreenIds: string[]
}
interface Props {
  token: string
  deviceType: DeviceType
  screens: StageScreen[]
  missions: Mission[]
}

interface BufferedEvent {
  missionId: string
  screenId: string
  type: "click" | "navigate" | "misclick" | "give_up" | "end"
  xNorm: number
  yNorm: number
  hotspotId?: string | null
  targetScreenId?: string | null
  timestampMs: number
}

type Phase = "intro" | "running" | "thanks"

export function TestRunner({ token, deviceType, screens, missions }: Props) {
  const [phase, setPhase] = useState<Phase>("intro")
  const [missionIndex, setMissionIndex] = useState(0)
  const [hasClicked, setHasClicked] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const bufferRef = useRef<BufferedEvent[]>([])
  const pendingFlushesRef = useRef<Promise<unknown>[]>([])
  const pathRef = useRef<string[]>([]) // caminho percorrido na missão atual
  const topRef = useRef<string>("") // tela visível no topo (base ou overlay)
  const clickCountRef = useRef(0)
  const misclickCountRef = useRef(0)
  const startTimeRef = useRef(0)
  const completedRef = useRef(false)

  const mission = missions[missionIndex]
  const isLastMission = missionIndex === missions.length - 1

  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now()

  const record = useCallback(
    (e: Omit<BufferedEvent, "missionId" | "timestampMs">) => {
      bufferRef.current.push({
        ...e,
        missionId: mission.id,
        timestampMs: Math.round(now() - startTimeRef.current),
      })
    },
    [mission.id]
  )

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return
    const events = bufferRef.current
    bufferRef.current = []
    try {
      await fetch("/api/t/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, events }),
        keepalive: true,
      })
    } catch {
      // Re-enfileira em caso de falha
      bufferRef.current = [...events, ...bufferRef.current]
    }
  }, [token])

  // Flush ao sair da página
  useEffect(() => {
    function onPageHide() {
      if (bufferRef.current.length === 0) return
      const payload = JSON.stringify({ token, events: bufferRef.current })
      navigator.sendBeacon(
        "/api/t/events",
        new Blob([payload], { type: "application/json" })
      )
      bufferRef.current = []
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [token])

  function startMission() {
    clickCountRef.current = 0
    misclickCountRef.current = 0
    startTimeRef.current = now()
    completedRef.current = false
    pendingFlushesRef.current = []
    pathRef.current = [mission.startScreenId]
    topRef.current = mission.startScreenId
    setHasClicked(false)
    setPanelCollapsed(false)
    record({
      screenId: mission.startScreenId,
      type: "navigate",
      xNorm: 0,
      yNorm: 0,
      targetScreenId: mission.startScreenId,
    })
    setPhase("running")
  }

  async function completeMission(
    signal: "reached" | "gave_up",
    lastEventScreenId: string
  ) {
    if (completedRef.current) return
    completedRef.current = true

    record({
      screenId: lastEventScreenId,
      type: signal === "gave_up" ? "give_up" : "end",
      xNorm: 0,
      yNorm: 0,
    })
    // Garante que todos os eventos (inclusive flushes de navegação em voo)
    // sejam persistidos antes de finalizar.
    await flush()
    await Promise.allSettled(pendingFlushesRef.current)
    pendingFlushesRef.current = []

    try {
      await fetch("/api/t/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          missionId: mission.id,
          signal,
          // Caminho percorrido enviado pelo cliente (fonte da verdade para a
          // classificação direct/indirect — evita corrida de persistência).
          path: pathRef.current,
          durationMs: Math.round(now() - startTimeRef.current),
          misclickCount: misclickCountRef.current,
          clickCount: clickCountRef.current,
          isLast: isLastMission,
        }),
        keepalive: true,
      })
    } catch {
      // segue mesmo se falhar
    }

    if (isLastMission) {
      setPhase("thanks")
    } else {
      setMissionIndex((i) => i + 1)
      setPhase("intro")
    }
  }

  async function handleInteraction(ev: StageInteraction) {
    if (completedRef.current) return

    clickCountRef.current += 1
    if (!hasClicked) {
      setHasClicked(true)
      setPanelCollapsed(true)
    }

    if (ev.kind === "misclick") {
      misclickCountRef.current += 1
      record({ screenId: ev.fromScreenId, type: "misclick", xNorm: ev.xNorm, yNorm: ev.yNorm })
      return
    }

    // Clique em hotspot: registra o ponto (heatmap) quando há coordenadas reais
    if (ev.hotspotId) {
      record({
        screenId: ev.fromScreenId,
        type: "click",
        xNorm: ev.xNorm,
        yNorm: ev.yNorm,
        hotspotId: ev.hotspotId,
        targetScreenId: ev.toScreenId,
      })
    }

    // Mudou a tela visível? registra navegação + atualiza caminho
    if (ev.topScreenId !== topRef.current) {
      topRef.current = ev.topScreenId
      record({
        screenId: ev.topScreenId,
        type: "navigate",
        xNorm: ev.xNorm,
        yNorm: ev.yNorm,
        targetScreenId: ev.topScreenId,
      })
      pathRef.current = dedupeConsecutive([...pathRef.current, ev.topScreenId])

      // Chegou na tela-alvo / tela final do caminho?
      if (mission.goalScreenIds.includes(ev.topScreenId)) {
        await completeMission("reached", ev.topScreenId)
        return
      }
      pendingFlushesRef.current.push(flush())
    }
  }

  // ─────────── Intro ───────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 px-6 space-y-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
              Tarefa {missionIndex + 1} de {missions.length}
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold">{mission.task}</h1>
              {mission.description && (
                <p className="text-sm text-muted-foreground">{mission.description}</p>
              )}
            </div>
            <Button onClick={startMission} className="w-full" size="lg">
              Começar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─────────── Thanks ───────────
  if (phase === "thanks") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center space-y-2">
            <h1 className="text-xl font-bold">Obrigado! 🎉</h1>
            <p className="text-sm text-muted-foreground">
              Você concluiu o teste. Pode fechar esta aba.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─────────── Running ───────────
  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center py-6 px-4">
      <PrototypeStage
        key={mission.id}
        screens={screens}
        deviceType={deviceType}
        initialScreenId={mission.startScreenId}
        onInteraction={handleInteraction}
      />

      <InstructionPanel
        task={mission.task}
        description={mission.description}
        missionIndex={missionIndex}
        missionCount={missions.length}
        collapsed={panelCollapsed}
        onToggle={() => setPanelCollapsed((c) => !c)}
        canGiveUp={hasClicked}
        onGiveUp={() => completeMission("gave_up", topRef.current)}
      />
    </div>
  )
}

// ════════════ Painel de instruções ════════════
function InstructionPanel({
  task,
  description,
  missionIndex,
  missionCount,
  collapsed,
  onToggle,
  canGiveUp,
  onGiveUp,
}: {
  task: string
  description: string | null
  missionIndex: number
  missionCount: number
  collapsed: boolean
  onToggle: () => void
  canGiveUp: boolean
  onGiveUp: () => void
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const draggingRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    setPos({
      x: draggingRef.current.baseX + (e.clientX - draggingRef.current.startX),
      y: draggingRef.current.baseY + (e.clientY - draggingRef.current.startY),
    })
  }
  function onPointerUp(e: React.PointerEvent) {
    draggingRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  return (
    <>
      {/* ─── Desktop: card flutuante arrastável ─── */}
      <div
        className="hidden md:block fixed top-4 right-4 z-50 w-72"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      >
        <div className="bg-white rounded-xl border shadow-xl overflow-hidden">
          <div
            className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/60 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <GripHorizontal className="h-3.5 w-3.5" />
              Tarefa {missionIndex + 1}/{missionCount}
            </span>
            <button
              onClick={onToggle}
              className="text-muted-foreground hover:text-foreground"
            >
              {collapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </div>
          {!collapsed && (
            <div className="p-3 space-y-3">
              <div>
                <p className="font-semibold text-sm">{task}</p>
                {description && (
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                )}
              </div>
              {canGiveUp && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={onGiveUp}
                >
                  <Flag className="h-3.5 w-3.5 mr-1.5" />
                  Não consegui / Encerrar tarefa
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile: barra inferior ─── */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Tarefa {missionIndex + 1}/{missionCount}
          </span>
          <button
            onClick={onToggle}
            className="text-xs text-primary font-medium"
          >
            {collapsed ? "Mostrar instruções" : "Ocultar"}
          </button>
        </div>
        {!collapsed && (
          <div className="px-4 pb-4 space-y-3">
            <div>
              <p className="font-semibold text-sm">{task}</p>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {canGiveUp && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={onGiveUp}
              >
                <Flag className="h-3.5 w-3.5 mr-1.5" />
                Não consegui / Encerrar tarefa
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
