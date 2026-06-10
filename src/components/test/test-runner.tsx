"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ClipboardList, Flag, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { type DeviceType } from "@/lib/device"
import { dedupeConsecutive } from "@/lib/path"
import { PrototypeStage, type StageScreen, type StageInteraction } from "@/components/prototype/stage"
import { tt, type Lang } from "@/lib/i18n"

interface Mission {
  id: string
  task: string
  description: string | null
  startScreenId: string
  goalScreenIds: string[]
}
interface Props {
  token: string
  lang: Lang
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

export function TestRunner({ token, lang, deviceType, screens, missions }: Props) {
  const s = tt(lang)
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
    setPanelCollapsed(false) // começa expandida: o testador lê a tarefa antes de agir
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
    if (!hasClicked) setHasClicked(true)
    // Ao interagir com o protótipo, a missão recolhe (a tela é a prioridade)
    setPanelCollapsed(true)

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
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-10 space-y-6">
          <div className="flex items-center gap-2 text-label-large text-on-surface-variant">
            <ClipboardList className="h-4 w-4" />
            {s.taskOf(missionIndex + 1, missions.length)}
          </div>
          <div className="space-y-2">
            <h1 className="text-headline-small text-on-surface">{mission.task}</h1>
            {mission.description && (
              <p className="text-body-medium text-on-surface-variant">{mission.description}</p>
            )}
          </div>
          <Button onClick={startMission} className="w-full h-12" size="lg">
            {s.start}
          </Button>
        </div>
      </div>
    )
  }

  // ─────────── Thanks ───────────
  if (phase === "thanks") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-12 text-center space-y-2">
          <h1 className="text-headline-small text-on-surface">{s.thanksTitle}</h1>
          <p className="text-body-medium text-on-surface-variant">{s.thanksBody}</p>
        </div>
      </div>
    )
  }

  // ─────────── Running ───────────
  return (
    <div className="min-h-screen bg-surface-container flex flex-col md:flex-row md:items-start gap-6 p-4 md:p-6">
      {/* Esquerda: missão (sempre presente; só encolhe pra cima) */}
      <aside className="w-full md:w-80 shrink-0 md:sticky md:top-6">
        <MissionCard
          label={s.taskOf(missionIndex + 1, missions.length)}
          task={mission.task}
          description={mission.description}
          giveUpLabel={s.giveUp}
          viewLabel={s.viewMission}
          collapsed={panelCollapsed}
          canGiveUp={hasClicked}
          onGiveUp={() => completeMission("gave_up", topRef.current)}
          onToggle={() => setPanelCollapsed((c) => !c)}
        />
      </aside>

      {/* Direita: protótipo */}
      <div className="flex-1 flex justify-center w-full">
        <PrototypeStage
          key={mission.id}
          screens={screens}
          deviceType={deviceType}
          initialScreenId={mission.startScreenId}
          onInteraction={handleInteraction}
        />
      </div>
    </div>
  )
}

// ════════════ Card da missão (coluna esquerda) ════════════
function MissionCard({
  label,
  task,
  description,
  giveUpLabel,
  viewLabel,
  collapsed,
  canGiveUp,
  onGiveUp,
  onToggle,
}: {
  label: string
  task: string
  description: string | null
  giveUpLabel: string
  viewLabel: string
  collapsed: boolean
  canGiveUp: boolean
  onGiveUp: () => void
  onToggle: () => void
}) {
  return (
    <div className="rounded-3xl bg-surface-container-low border border-outline-variant p-6">
      {/* Cabeçalho (sempre visível) */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-label-large text-on-surface-variant">
          <ClipboardList className="h-4 w-4" />
          {label}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "shrink-0 flex items-center gap-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high",
            collapsed ? "px-3 py-1.5 text-title-small text-primary" : "p-1.5"
          )}
          title={collapsed ? viewLabel : "Ocultar"}
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-4 w-4" />
              {viewLabel}
            </>
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Corpo (encolhe pra cima) */}
      {!collapsed && (
        <>
          <div className="space-y-2 mt-4">
            <h2 className="text-title-large text-on-surface">{task}</h2>
            {description && (
              <p className="text-body-medium text-on-surface-variant">{description}</p>
            )}
          </div>

          {canGiveUp && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mt-4 text-on-surface-variant"
              onClick={onGiveUp}
            >
              <Flag className="h-3.5 w-3.5 mr-1.5" />
              {giveUpLabel}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
