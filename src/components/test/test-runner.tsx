"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ClipboardList, Flag, Play, Check, ClipboardCheck, MousePointerClick, Clock } from "lucide-react"
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

interface WelcomeInfo {
  title: string
  message: string
  taskCount: number
}

interface Props {
  token: string
  lang: Lang
  deviceType: DeviceType
  screens: StageScreen[]
  steps: Step[]
  // Modo revisão/preview: percorre o fluxo inteiro sem gravar nenhum dado.
  preview?: boolean
  // Quando presente, mostra a tela de boas-vindas antes dos passos.
  welcome?: WelcomeInfo | null
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

export function TestRunner({
  token,
  lang,
  deviceType,
  screens,
  steps,
  preview = false,
  welcome = null,
}: Props) {
  const s = tt(lang)
  const [stepIndex, setStepIndex] = useState(0)
  const [flowStarted, setFlowStarted] = useState(!welcome) // sem welcome → já começa
  const [taskStarted, setTaskStarted] = useState(false) // subfase da missão
  const [toast, setToast] = useState<string | null>(null) // "Tarefa X concluída"
  const [finished, setFinished] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

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
    if (preview || bufferRef.current.length === 0) return
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
  }, [token, preview])

  // Flush ao sair da página (nunca no preview/revisão)
  useEffect(() => {
    if (preview) return
    function onPageHide() {
      if (bufferRef.current.length === 0) return
      const payload = JSON.stringify({ token, events: bufferRef.current })
      navigator.sendBeacon("/api/t/events", new Blob([payload], { type: "application/json" }))
      bufferRef.current = []
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [token, preview])

  // No preview/revisão cada passo de missão começa "pronto para explorar":
  // reinicia o estado de interação (senão completedRef do passo anterior trava).
  useEffect(() => {
    if (!preview) return
    completedRef.current = false
    clickCountRef.current = 0
    misclickCountRef.current = 0
    startTimeRef.current = now()
    if (mission) {
      pathRef.current = [mission.startScreenId]
      topRef.current = mission.startScreenId
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, preview])

  // Avança para o próximo passo — ou finaliza a sessão inteira.
  const advance = useCallback(() => {
    if (isLastStep) {
      setFinished(true)
      if (!preview) {
        fetch("/api/t/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          keepalive: true,
        }).catch(() => {})
      }
    } else {
      setStepIndex((i) => i + 1)
      setTaskStarted(false)
    }
  }, [isLastStep, token, preview])

  function startTask() {
    if (!mission) return
    clickCountRef.current = 0
    misclickCountRef.current = 0
    startTimeRef.current = now()
    completedRef.current = false
    pendingFlushesRef.current = []
    pathRef.current = [mission.startScreenId]
    topRef.current = mission.startScreenId
    bufferRef.current.push({
      missionId: mission.id,
      screenId: mission.startScreenId,
      type: "navigate",
      xNorm: 0,
      yNorm: 0,
      targetScreenId: mission.startScreenId,
      timestampMs: 0,
    })
    // Persiste o INÍCIO da tarefa imediatamente: é o que permite, no relatório,
    // distinguir "iniciou e sumiu" (perdida) de "nunca chegou aqui".
    pendingFlushesRef.current.push(flush())
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

    if (!preview) {
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
    }

    // Concluiu a tarefa (chegou no objetivo) → toast "Tarefa X concluída".
    // Quem desiste não vê o toast. Em ambos os casos segue para o próximo passo.
    if (signal === "reached") {
      const taskNumber = steps
        .slice(0, stepIndex + 1)
        .filter((st) => st.kind === "mission").length
      showToast(s.taskDoneToast(taskNumber))
    }
    advance()
  }

  async function handleInteraction(ev: StageInteraction) {
    if (!mission || completedRef.current) return

    clickCountRef.current += 1

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
    if (hasValue && !preview) {
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

  // No preview/revisão o protótipo já fica interativo (sem "Iniciar tarefa").
  const started = preview || taskStarted
  let content: React.ReactNode

  if (welcome && !flowStarted) {
    // ─────────── Boas-vindas (fluxo inteiro) ───────────
    content = (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-10 space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary mb-1">
              <ClipboardCheck className="h-7 w-7" />
            </div>
            <h1 className="text-headline-small text-on-surface">
              {welcome.title || s.welcomeTitle}
            </h1>
            <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">
              {welcome.message || s.welcomeIntro}
            </p>
          </div>
          <div className="space-y-4 text-body-medium text-on-surface">
            <div className="flex items-start gap-3">
              <MousePointerClick className="h-5 w-5 mt-0.5 text-on-surface-variant shrink-0" />
              <span>{s.tasksCount(welcome.taskCount)}</span>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 mt-0.5 text-on-surface-variant shrink-0" />
              <span>{s.anonymous}</span>
            </div>
          </div>
          <Button onClick={() => setFlowStarted(true)} className="w-full h-12" size="lg">
            {s.start}
          </Button>
        </div>
      </div>
    )
  } else if (finished || !step) {
    // ─────────── Fim ───────────
    content = (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-12 text-center space-y-2">
          <h1 className="text-headline-small text-on-surface">{s.thanksTitle}</h1>
          <p className="text-body-medium text-on-surface-variant">{s.thanksBody}</p>
        </div>
      </div>
    )
  } else if (step.kind === "question") {
    // ─────────── Pergunta ───────────
    content = (
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
  } else {
    // ─────────── Missão (tela dividida: tarefa | protótipo) ───────────
    content = (
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        {/* Metade esquerda: a tarefa (sem card) */}
        <div className="flex flex-col justify-center px-6 py-10 md:px-12 lg:px-16 bg-surface">
          <div className="w-full max-w-md md:ml-auto md:mr-8 space-y-6">
            <div className="flex items-center gap-2 text-label-large text-on-surface-variant">
              <ClipboardList className="h-4 w-4" />
              {s.stepOf(stepIndex + 1, steps.length)}
            </div>

            <div className="space-y-3">
              <h1 className="text-headline-medium text-on-surface">{step.mission.task}</h1>
              {step.mission.description && (
                <p className="text-body-large text-on-surface-variant">
                  {step.mission.description}
                </p>
              )}
            </div>

            {preview ? (
              // Revisão: protótipo já interativo; botão para seguir o fluxo.
              <Button onClick={advance} className="h-12 px-6" size="lg">
                {isLastStep ? "Concluir revisão" : "Avançar"}
              </Button>
            ) : !started ? (
              <Button onClick={startTask} className="h-12 px-6" size="lg">
                <Play className="h-4 w-4 mr-2" />
                {s.startTask}
              </Button>
            ) : (
              // Sempre visível durante a tarefa (desde a 1ª tela), mesmo sem clique.
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 text-on-surface-variant"
                onClick={() => completeMission("gave_up", topRef.current)}
              >
                <Flag className="h-3.5 w-3.5 mr-1.5" />
                {s.giveUp}
              </Button>
            )}
          </div>
        </div>

        {/* Metade direita: o protótipo */}
        <div className="flex items-center justify-center px-6 py-10 md:px-12 bg-surface-container overflow-auto">
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

  return (
    <>
      {content}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2.5 elevation-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="h-4 w-4" />
          <span className="text-title-small">{toast}</span>
        </div>
      )}
    </>
  )
}

