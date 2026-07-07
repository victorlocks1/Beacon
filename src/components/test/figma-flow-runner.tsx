"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ClipboardList, Flag, Play, Check, ClipboardCheck, MousePointerClick, Clock } from "lucide-react"
import { figmaEmbedUrl, FIGMA_EVENT_TYPES } from "@/lib/figma-embed"
import { QuestionView, type StepQuestion, type AnswerPayload } from "@/components/test/question-view"
import { type Step } from "@/components/test/test-runner"
import { tt, type Lang } from "@/lib/i18n"

interface WelcomeInfo {
  title: string
  message: string
  taskCount: number
}

interface BufferedEvent {
  type: string
  data: unknown
  clientTsMs: number
  missionId: string | null
}

const VALID = new Set<string>(FIGMA_EVENT_TYPES)

// Runner do protótipo VIVO do Figma no fluxo completo: boas-vindas → tarefas
// (painel + embed) → perguntas → obrigado. Captura os eventos da Embed API
// (marcados por tarefa) e conclui a tarefa quando o frame-objetivo é alcançado.
export function FigmaFlowRunner({
  token,
  lang,
  fileKey,
  steps,
  welcome,
  goalsByMission,
  nodeToScreen,
}: {
  token: string
  lang: Lang
  fileKey: string
  steps: Step[]
  welcome: WelcomeInfo | null
  goalsByMission: Record<string, string[]> // missionId → node-ids objetivo (Figma)
  nodeToScreen: Record<string, string> // figmaNodeId → screenId (p/ o caminho)
}) {
  const s = tt(lang)
  const [stepIndex, setStepIndex] = useState(0)
  const [flowStarted, setFlowStarted] = useState(!welcome)
  const [taskStarted, setTaskStarted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const step = steps[stepIndex]
  const mission = step?.kind === "mission" ? step.mission : null
  const isLastStep = stepIndex === steps.length - 1

  // refs lidos pelo listener de eventos (que é montado uma vez)
  const missionRef = useRef<string | null>(null)
  const startedRef = useRef(false)
  const completedRef = useRef(false)
  const startTimeRef = useRef(0)
  const pathRef = useRef<string[]>([]) // caminho em screenIds
  const clickCountRef = useRef(0)
  const misclickCountRef = useRef(0)
  const bufferRef = useRef<BufferedEvent[]>([])
  const epochRef = useRef(0)

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now())

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return
    const events = bufferRef.current
    bufferRef.current = []
    try {
      await fetch("/api/t/figma-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, events }),
        keepalive: true,
      })
    } catch {
      bufferRef.current = [...events, ...bufferRef.current]
    }
  }, [token])

  // monta a URL do embed uma vez (host real p/ bater com o Allowed origin)
  useEffect(() => {
    setEmbedSrc(figmaEmbedUrl({ fileKey, startNodeId: null, host: window.location.host }))
    epochRef.current = now()
  }, [fileKey])

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
      startedRef.current = false
    }
  }, [isLastStep, token])

  const completeMission = useCallback(
    async (signal: "reached" | "gave_up") => {
      if (!missionRef.current || completedRef.current) return
      completedRef.current = true
      const missionId = missionRef.current
      await flush()
      try {
        await fetch("/api/t/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            missionId,
            signal,
            path: pathRef.current,
            durationMs: Math.round(now() - startTimeRef.current),
            misclickCount: misclickCountRef.current,
            clickCount: clickCountRef.current,
          }),
          keepalive: true,
        })
      } catch {
        /* segue */
      }
      if (signal === "reached") {
        const taskNumber = steps.slice(0, stepIndex + 1).filter((st) => st.kind === "mission").length
        showToast(s.taskDoneToast(taskNumber))
      }
      advance()
    },
    [advance, flush, s, showToast, steps, stepIndex, token]
  )

  // Listener global dos eventos da Embed API (Figma). Marca por tarefa, monta o
  // caminho e conclui a tarefa ao alcançar o frame-objetivo.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.origin.includes("figma.com")) return
      const d = e.data
      if (!d || typeof d !== "object" || !VALID.has(d.type)) return

      bufferRef.current.push({
        type: d.type,
        data: d.data ?? {},
        clientTsMs: Math.round(now() - epochRef.current),
        missionId: startedRef.current ? missionRef.current : null,
      })

      if (!startedRef.current) return

      if (d.type === "MOUSE_PRESS_OR_RELEASE") {
        clickCountRef.current += 1
        if (d.data?.handled === false) misclickCountRef.current += 1
      }

      if (d.type === "PRESENTED_NODE_CHANGED") {
        const nodeId = d.data?.presentedNodeId as string | undefined
        if (nodeId) {
          const screenId = nodeToScreen[nodeId]
          if (screenId && pathRef.current[pathRef.current.length - 1] !== screenId) {
            pathRef.current.push(screenId)
          }
          const goals = missionRef.current ? goalsByMission[missionRef.current] ?? [] : []
          if (goals.includes(nodeId)) completeMission("reached")
        }
      }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // flush periódico + ao sair
  useEffect(() => {
    const id = setInterval(flush, 3000)
    function onHide() {
      if (bufferRef.current.length === 0) return
      navigator.sendBeacon(
        "/api/t/figma-events",
        new Blob([JSON.stringify({ token, events: bufferRef.current })], { type: "application/json" })
      )
      bufferRef.current = []
    }
    window.addEventListener("pagehide", onHide)
    return () => {
      clearInterval(id)
      window.removeEventListener("pagehide", onHide)
      flush()
    }
  }, [flush, token])

  function startTask() {
    if (!mission) return
    completedRef.current = false
    startTimeRef.current = now()
    clickCountRef.current = 0
    misclickCountRef.current = 0
    pathRef.current = mission.startScreenId ? [mission.startScreenId] : []
    missionRef.current = mission.id
    startedRef.current = true
    setTaskStarted(true)
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
          body: JSON.stringify({ token, questionId: (step.question as StepQuestion).id, ...payload }),
          keepalive: true,
        })
      } catch {
        /* segue */
      }
    }
    advance()
  }

  // ─────────── Render ───────────
  let content: React.ReactNode

  if (welcome && !flowStarted) {
    content = (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-10 space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary mb-1">
              <ClipboardCheck className="h-7 w-7" />
            </div>
            <h1 className="text-headline-small text-on-surface">{welcome.title || s.welcomeTitle}</h1>
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
    content = (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant elevation-1 p-12 text-center space-y-2">
          <h1 className="text-headline-small text-on-surface">{s.thanksTitle}</h1>
          <p className="text-body-medium text-on-surface-variant">{s.thanksBody}</p>
        </div>
      </div>
    )
  } else if (step.kind === "question") {
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
    // Missão: tarefa à esquerda, protótipo VIVO à direita
    content = (
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-10 md:px-12 lg:px-16 bg-surface">
          <div className="w-full max-w-md md:ml-auto md:mr-8 space-y-6">
            <div className="flex items-center gap-2 text-label-large text-on-surface-variant">
              <ClipboardList className="h-4 w-4" />
              {s.stepOf(stepIndex + 1, steps.length)}
            </div>
            <div className="space-y-3">
              <h1 className="text-headline-medium text-on-surface">{step.mission.task}</h1>
              {step.mission.description && (
                <p className="text-body-large text-on-surface-variant">{step.mission.description}</p>
              )}
            </div>
            {!taskStarted ? (
              <Button onClick={startTask} className="h-12 px-6" size="lg">
                <Play className="h-4 w-4 mr-2" />
                {s.startTask}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 text-on-surface-variant"
                onClick={() => completeMission("gave_up")}
              >
                <Flag className="h-3.5 w-3.5 mr-1.5" />
                {s.giveUp}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 md:px-12 bg-surface-container overflow-auto">
          <div
            className={
              "bg-white rounded-2xl overflow-hidden shadow-lg transition-opacity duration-300 " +
              (!taskStarted ? "opacity-40 pointer-events-none select-none" : "")
            }
            style={{ width: 360, height: 800, maxWidth: "100%" }}
            aria-hidden={!taskStarted}
          >
            {embedSrc && (
              <iframe
                title="Protótipo"
                src={embedSrc}
                allowFullScreen
                style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              />
            )}
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
