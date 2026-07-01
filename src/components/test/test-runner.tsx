"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ClipboardList, Flag, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { type DeviceType } from "@/lib/device"
import { dedupeConsecutive } from "@/lib/path"
import { PrototypeStage, type StageScreen, type StageInteraction } from "@/components/prototype/stage"
import { QuestionView, type StepQuestion, type AnswerPayload } from "@/components/test/question-view"
import { tt, type Lang } from "@/lib/i18n"

interface Mission {
  id: string
  task: string
  description: string | null
  startScreenId: string
  goalScreenIds: string[]
}

export type Step =
  | { kind: "mission"; mission: Mission }
  | { kind: "question"; question: StepQuestion }

interface Props {
  token: string
  lang: Lang
  deviceType: DeviceType
  screens: StageScreen[]
  steps: Step[]
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

export function TestRunner({ token, lang, deviceType, screens, steps }: Props) {
  const s = tt(lang)
  const [stepIndex, setStepIndex] = useState(0)
  const [taskStarted, setTaskStarted] = useState(false) // subfase da missão
  const [hasClicked, setHasClicked] = useState(false)
  const [finished, setFinished] = useState(false)

  const bufferRef = useRef<BufferedEvent[]>([])
  const pendingFlushesRef = useRef<Promise<unknown>[]>([])
  const pathRef = useRef<string[]>([]) // caminho percorrido na missão atual
  const topRef = useRef<string>("") // tela visível no topo (base ou overlay)
  const clickCountRef = useRef(0)
  const misclickCountRef = useRef(0)
  const startTimeRef = useRef(0)
  const completedRef = useRef(false)

  const step = steps[stepIndex]
  const mission = step?.kind === "mission" ? step.mission : null
  const isLastStep = stepIndex === steps.length - 1

  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now()

  const record = useCallback(
    (e: Omit<BufferedEvent, "missionId" | "timestampMs">) => {
      if (!mission) return
      bufferRef.current.push({
        ...e,
        missionId: mission.id,
        timestampMs: Math.round(now() - startTimeRef.current),
      })
    },
    [mission]
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
      bufferRef.current = [...events, ...bufferRef.current]
    }
  }, [token])

  // Flush ao sair da página
  useEffect(() => {
    function onPageHide() {
      if (bufferRef.current.length === 0) return
      const payload = JSON.stringify({ token, events: bufferRef.current })
      navigator.sendBeacon("/api/t/events", new Blob([payload], { type: "application/json" }))
      bufferRef.current = []
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [token])

  // Avança para o próximo passo — ou finaliza a sessão inteira.
  const advance = useCallback(() => {
    if (isLastStep) {
      setFinished(true)
      fetch("/api/t/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        keepalive: true,
      }).catch(() => {})
    } else {
      setStepIndex((i) => i + 1)
      setTaskStarted(false)
      setHasClicked(false)
    }
  }, [isLastStep, token])

  function startTask() {
    if (!mission) return
    clickCountRef.current = 0
    misclickCountRef.current = 0
    startTimeRef.current = now()
    completedRef.current = false
    pendingFlushesRef.current = []
    pathRef.current = [mission.startScreenId]
    topRef.current = mission.startScreenId
    setHasClicked(false)
    bufferRef.current.push({
      missionId: mission.id,
      screenId: mission.startScreenId,
      type: "navigate",
      xNorm: 0,
      yNorm: 0,
      targetScreenId: mission.startScreenId,
      timestampMs: 0,
    })
    setTaskStarted(true)
  }

  async function completeMission(signal: "reached" | "gave_up", lastEventScreenId: string) {
    if (!mission || completedRef.current) return
    completedRef.current = true

    record({
      screenId: lastEventScreenId,
      type: signal === "gave_up" ? "give_up" : "end",
      xNorm: 0,
      yNorm: 0,
    })
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
          path: pathRef.current,
          durationMs: Math.round(now() - startTimeRef.current),
          misclickCount: misclickCountRef.current,
          clickCount: clickCountRef.current,
        }),
        keepalive: true,
      })
    } catch {
      // segue mesmo se falhar
    }

    advance()
  }

  async function handleInteraction(ev: StageInteraction) {
    if (!mission || completedRef.current) return

    clickCountRef.current += 1
    if (!hasClicked) setHasClicked(true)

    if (ev.kind === "misclick") {
      misclickCountRef.current += 1
      record({ screenId: ev.fromScreenId, type: "misclick", xNorm: ev.xNorm, yNorm: ev.yNorm })
      return
    }

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

      if (mission.goalScreenIds.includes(ev.topScreenId)) {
        await completeMission("reached", ev.topScreenId)
        return
      }
      pendingFlushesRef.current.push(flush())
    }
  }

  async function submitAnswer(payload: AnswerPayload) {
    if (step?.kind !== "question") return
    const hasValue =
      (typeof payload.text === "string" && payload.text.length > 0) ||
      (typeof payload.choice === "string" && payload.choice.length > 0) ||
      typeof payload.rating === "number"
    if (hasValue) {
      try {
        await fetch("/api/t/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, questionId: step.question.id, ...payload }),
          keepalive: true,
        })
      } catch {
        // segue mesmo se falhar
      }
    }
    advance()
  }

  // ─────────── Fim ───────────
  if (finished || !step) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-12 text-center space-y-2">
          <h1 className="text-headline-small text-on-surface">{s.thanksTitle}</h1>
          <p className="text-body-medium text-on-surface-variant">{s.thanksBody}</p>
        </div>
      </div>
    )
  }

  // ─────────── Pergunta ───────────
  if (step.kind === "question") {
    return (
      <div className="min-h-screen bg-surface-container flex items-center justify-center p-4 md:p-6">
        <QuestionView
          key={step.question.id}
          question={step.question}
          lang={lang}
          stepLabel={s.stepOf(stepIndex + 1, steps.length)}
          onSubmit={submitAnswer}
        />
      </div>
    )
  }

  // ─────────── Missão (intro apagada / execução) ───────────
  const started = taskStarted
  return (
    <div className="min-h-screen bg-surface-container flex flex-col md:flex-row md:items-start gap-6 p-4 md:p-6">
      <aside className="w-full md:w-80 shrink-0 md:sticky md:top-6">
        <MissionCard
          label={s.stepOf(stepIndex + 1, steps.length)}
          task={step.mission.task}
          description={step.mission.description}
          started={started}
          startLabel={s.startTask}
          onStart={startTask}
          giveUpLabel={s.giveUp}
          canGiveUp={hasClicked}
          onGiveUp={() => completeMission("gave_up", topRef.current)}
        />
      </aside>

      <div className="flex-1 flex justify-center w-full">
        <div
          className={cn(
            "transition-opacity duration-300",
            !started && "opacity-40 pointer-events-none select-none"
          )}
          aria-hidden={!started}
        >
          <PrototypeStage
            key={step.mission.id}
            screens={screens}
            deviceType={deviceType}
            initialScreenId={step.mission.startScreenId}
            onInteraction={handleInteraction}
          />
        </div>
      </div>
    </div>
  )
}

// ════════════ Card da missão (coluna esquerda) ════════════
function MissionCard({
  label,
  task,
  description,
  started,
  startLabel,
  onStart,
  giveUpLabel,
  canGiveUp,
  onGiveUp,
}: {
  label: string
  task: string
  description: string | null
  started: boolean
  startLabel: string
  onStart: () => void
  giveUpLabel: string
  canGiveUp: boolean
  onGiveUp: () => void
}) {
  return (
    <div className="rounded-3xl bg-surface-container-low border border-outline-variant p-6">
      <div className="flex items-center gap-2 text-label-large text-on-surface-variant">
        <ClipboardList className="h-4 w-4" />
        {label}
      </div>

      <div className="space-y-2 mt-4">
        <h2 className="text-title-large text-on-surface">{task}</h2>
        {description && (
          <p className="text-body-medium text-on-surface-variant">{description}</p>
        )}
      </div>

      {!started ? (
        <Button onClick={onStart} className="w-full h-12 mt-6" size="lg">
          <Play className="h-4 w-4 mr-2" />
          {startLabel}
        </Button>
      ) : (
        canGiveUp && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mt-4 text-on-surface-variant"
            onClick={onGiveUp}
          >
            <Flag className="h-3.5 w-3.5 mr-1.5" />
            {giveUpLabel}
          </Button>
        )
      )}
    </div>
  )
}
