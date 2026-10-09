"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ClipboardList, Flag, Play, Check, ClipboardCheck, MousePointerClick, Clock, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { figmaEmbedUrl, runEmbedHotspotAction, actsOnPress, FIGMA_EVENT_TYPES } from "@/lib/figma-embed"
import { type RunnerHotspot } from "@/lib/figma-runner"
import { QuestionView, type StepQuestion, type AnswerPayload } from "@/components/test/question-view"
import { SeqScale } from "@/components/test/seq-scale"
import { HowItWorksScreen } from "@/components/test/how-it-works-screen"
import { SusView } from "@/components/test/sus-view"
import { FloatingTaskWidget } from "@/components/test/floating-task-widget"
import { type Step } from "@/components/test/test-runner"
import { tt, type Lang } from "@/lib/i18n"
import { type PathStepDef } from "@/lib/path"
import { frameLayout } from "@/lib/device"
import { clickContentPoint, hotspotAt, CLICK_PAIR_MS, DRAG_PX } from "@/lib/figma-clicks"

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

// Evento no NOSSO modelo (o mesmo que o fluxo por imagem grava), derivado dos
// eventos do Figma — assim os relatórios existentes funcionam sem mudança.
interface OurEvent {
  missionId: string
  screenId: string
  type: "click" | "navigate" | "misclick" | "give_up" | "end"
  xNorm: number
  yNorm: number
  hotspotId?: string | null
  targetScreenId?: string | null
  timestampMs: number
}

const VALID = new Set<string>(FIGMA_EVENT_TYPES)

// Zoom no embed. 1 = sem recorte (protótipo SEM device frame no Figma → a tela
// 9:20 preenche o quadro 9:20 exatamente, sem preto e sem cortar as laterais).
// Só aumente se o protótipo tiver moldura no Figma (o certo é Device: None lá).
const FRAME_CROP = 1.0
// Fração do excesso vertical cortada do TOPO (só relevante com FRAME_CROP > 1).
const FRAME_CROP_TOP = 0.3

// Runner do protótipo VIVO do Figma no fluxo completo: boas-vindas → tarefas
// (painel + embed) → perguntas → obrigado. Captura os eventos da Embed API
// (marcados por tarefa) e conclui a tarefa quando o frame-objetivo é alcançado.
export function FigmaFlowRunner({
  token,
  lang,
  fileKey,
  steps,
  welcome,
  howItWorks,
  thanksTitle,
  thanksMessage,
  susStatements,
  sumEnabled,
  sumStatements,
  sumAnchors,
  goalsByMission,
  startNodeByMission,
  successTypeByMission,
  expectedPathsByMission,
  screenByNode,
  scrollFrameGeomByScreen,
  hotspotsByNode = {},
  goalHotspotsByMission = {},
  deviceType = "desktop",
  frameW = 360,
  frameH = 800,
  preview = false,
}: {
  // Modo revisão: roda o fluxo inteiro no protótipo vivo sem gravar nenhum dado.
  preview?: boolean
  token: string
  lang: Lang
  fileKey: string
  steps: Step[]
  welcome: WelcomeInfo | null
  howItWorks: string | null
  thanksTitle?: string | null
  thanksMessage?: string | null
  susStatements?: string[]
  sumEnabled?: boolean // SUM: coleta o ASQ (3 perguntas) após cada tarefa
  sumStatements?: string[] // enunciados do ASQ (resolvidos por idioma)
  sumAnchors?: { low: string; high: string } // âncoras da escala 1..7
  goalsByMission: Record<string, string[]> // missionId → node-ids objetivo (Figma)
  startNodeByMission: Record<string, string | null> // missionId → node-id inicial (Figma)
  successTypeByMission: Record<string, "screen" | "path" | "hotspot"> // critério de sucesso da missão
  // figmaNodeId da tela → hotspots desenhados no Beacon (coords normalizadas na tela)
  hotspotsByNode?: Record<string, RunnerHotspot[]>
  // missionId → hotspots que concluem a tarefa (critério "clique em hotspot")
  goalHotspotsByMission?: Record<string, string[]>
  expectedPathsByMission: Record<string, PathStepDef[][]> // caminhos esperados (passos c/ opcional/wildcard)
  screenByNode: Record<string, { id: string; w: number; h: number }> // figmaNodeId → tela
  // figmaNodeId da TELA → { figmaNodeId do frame rolável → origem/tam normalizados }.
  // Por tela (não global) porque o mesmo frame pode aparecer sob telas diferentes
  // (bottomsheet sobre a tela de trás) com origens distintas.
  scrollFrameGeomByScreen: Record<string, Record<string, { x: number; y: number; w: number; h: number }>>
  deviceType?: "desktop" | "tablet" | "mobile" // define proporção/tamanho do quadro do protótipo
  frameW?: number // dimensões reais do frame do protótipo (para a proporção certa)
  frameH?: number
}) {
  const s = tt(lang)
  // Dispositivo do protótipo: mobile usa o quadro de celular (retrato estreito);
  // web/tablet usam a proporção REAL do frame (paisagem), sem moldura de celular.
  const isMobile = deviceType === "mobile"
  const [stepIndex, setStepIndex] = useState(0)
  const [flowStarted, setFlowStarted] = useState(!welcome)
  const [introDone, setIntroDone] = useState(!howItWorks) // tela "Como funciona"
  const [taskStarted, setTaskStarted] = useState(false)
  const [interacted, setInteracted] = useState(false) // já houve o 1º clique na tarefa
  const [embedLoaded, setEmbedLoaded] = useState(false) // protótipo do Figma pronto
  // um hotspot do Beacon acabou de mandar o protótipo navegar: sinal imediato de
  // "clique reconhecido" até a nova tela aparecer
  const [navigating, setNavigating] = useState(false)
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadProgress, setLoadProgress] = useState(0) // 0..100 da barra de carregamento
  // conclusão da tarefa (feedback + botão continuar) antes de seguir
  const [completion, setCompletion] = useState<null | "reached" | "gave_up">(null)
  const [finished, setFinished] = useState(false)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  // nota de estrelas embutida no feedback de sucesso (quando a próxima pergunta
  // é de estrelas, respondemos ali mesmo pra poupar um clique)
  const [inlineRating, setInlineRating] = useState(0)
  // SUM: respostas do ASQ (3 × 1..7) coletadas no feedback de cada tarefa
  const [sumValues, setSumValues] = useState<number[]>([0, 0, 0])
  const sumAnswered = sumValues.every((v) => v >= 1)

  const step = steps[stepIndex]
  const mission = step?.kind === "mission" ? step.mission : null
  const isLastStep = stepIndex === steps.length - 1

  // Se o próximo passo for uma pergunta de ESTRELAS, mostramos as estrelas
  // abaixo do feedback de conclusão da tarefa (só no sucesso) e pulamos aquele
  // step — evita a tela extra só pra dar a nota.
  const nextStep = steps[stepIndex + 1]
  const inlineRatingQ =
    completion === "reached" &&
    nextStep?.kind === "question" &&
    nextStep.question.type === "rating" &&
    !nextStep.question.screen
      ? (nextStep.question as StepQuestion)
      : null

  // node-id do Figma onde a missão atual começa (null → frame padrão do protótipo)
  const currentStartNode = mission ? startNodeByMission[mission.id] ?? null : null
  // Quadro do protótipo: proporção do frame de partida da missão. Página mais
  // alta que a tela → quadro do tamanho do viewport, com rolagem vertical.
  const startDims = currentStartNode ? screenByNode[currentStartNode] : undefined
  const layout = frameLayout(startDims?.w ?? frameW, startDims?.h ?? frameH, deviceType)

  // refs lidos pelo listener de eventos (que é montado uma vez)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const missionRef = useRef<string | null>(null)
  const startNodeRef = useRef<string | null>(null)
  const startedRef = useRef(false)
  const completedRef = useRef(false)
  const startTimeRef = useRef(0)
  const interactedRef = useRef(false) // guarda p/ marcar o 1º clique uma vez
  // press pendente: pareia press+release. Clique = quase sem movimento; arraste
  // (scroll/swipe) = movimento grande → NÃO conta como clique.
  const pendingPressRef = useRef<
    {
      t: number
      x: number
      y: number
      // offset de scroll do frame rolável no momento do clique (px)
      ox: number
      oy: number
      handled: boolean
      // o hotspot do Beacon sob este press já mandou o protótipo navegar
      acted?: boolean
      // este clique já foi contado (não contar de novo no 2º evento/navegação)
      counted?: boolean
      // em toque: espera curta para descartar arraste antes de contar
      timer?: ReturnType<typeof setTimeout>
      nodeId: string | undefined
      // id do frame ROLÁVEL sob o clique (nearestScrollingFrameId). A posição do
      // clique vem relativa ao viewport DESSE frame; somamos a origem dele na tela
      // (via scrollFrameGeomByNode) para posicionar certo no heatmap.
      sfId: string | undefined
    } | null
  >(null)
  // instante da última contagem de clique na navegação — usado para ignorar o
  // evento de "release" que chega logo depois (senão viraria um press fantasma).
  const postNavRef = useRef(0)
  // rastreador do caminho exato: por caminho esperado, progresso contíguo + se
  // manteve limpo (sem desvio). len = telas consecutivas certas a partir do início.
  const matchRef = useRef<{ steps: PathStepDef[]; len: number; clean: boolean }[]>([])
  const pathRef = useRef<string[]>([]) // caminho em screenIds
  const clickCountRef = useRef(0)
  const misclickCountRef = useRef(0)
  const bufferRef = useRef<BufferedEvent[]>([])
  // eventos traduzidos p/ o nosso modelo (alimentam TODOS os relatórios)
  const ourBufferRef = useRef<OurEvent[]>([])
  const epochRef = useRef(0)

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now())

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

  const flush = useCallback(async () => {
    if (preview) {
      bufferRef.current = []
      ourBufferRef.current = []
      return
    }
    // 1) eventos crus do Figma
    if (bufferRef.current.length > 0) {
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
    }
    // 2) eventos traduzidos p/ o nosso modelo (relatórios)
    if (ourBufferRef.current.length > 0) {
      const events = ourBufferRef.current
      ourBufferRef.current = []
      try {
        await fetch("/api/t/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, events }),
          keepalive: true,
        })
      } catch {
        ourBufferRef.current = [...events, ...ourBufferRef.current]
      }
    }
  }, [token, preview])

  // Cada missão abre no seu frame de partida. Ao trocar de missão o embed
  // recarrega ali (reset limpo entre tarefas). host real p/ o Allowed origin.
  useEffect(() => {
    // testador: sem as dicas azuis do Figma (não entregar a área clicável)
    setEmbedLoaded(false) // volta o loader ao (re)carregar o embed
    setEmbedSrc(
      figmaEmbedUrl({
        fileKey,
        startNodeId: currentStartNode,
        host: window.location.host,
        hotspotHints: false,
        scaling: layout.scaling,
      })
    )
    epochRef.current = now()
    // rede de segurança: se o INITIAL_LOAD não chegar, esconde o loader mesmo assim
    const t = setTimeout(() => setEmbedLoaded(true), 10000)
    return () => clearTimeout(t)
  }, [fileKey, currentStartNode, layout.scaling])

  // Barra de carregamento: enche SEMPRE avançando (desacelera perto do fim mas
  // nunca congela) enquanto o embed não está pronto; completa quando fica pronto.
  useEffect(() => {
    if (embedLoaded) {
      setLoadProgress(100)
      return
    }
    setLoadProgress(8) // recomeça a cada (re)carregamento do embed
    const id = setInterval(() => {
      setLoadProgress((p) => {
        if (p >= 96) return 96 // teto: os últimos % ficam para o "pronto"
        // desacelera em degraus, mas sempre soma algo → nunca parece travado
        const step = p < 55 ? 5 : p < 80 ? 1.8 : 0.7
        return Math.min(96, p + step)
      })
    }, 120)
    return () => clearInterval(id)
  }, [embedLoaded, embedSrc])

  const finishFlow = useCallback(() => {
    setFinished(true)
    if (preview) return
    fetch("/api/t/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => {})
  }, [token, preview])

  const advance = useCallback(() => {
    if (isLastStep) {
      finishFlow()
    } else {
      setStepIndex((i) => i + 1)
      setTaskStarted(false)
      startedRef.current = false
    }
  }, [isLastStep, finishFlow])

  const completeMission = useCallback(
    (signal: "reached" | "gave_up", outcome?: "direct" | "indirect") => {
      if (!missionRef.current || completedRef.current) return
      completedRef.current = true
      const missionId = missionRef.current
      // evento de fim/desistência na última tela vista (p/ tela de abandono)
      const lastScreen = pathRef.current[pathRef.current.length - 1]
      if (lastScreen) {
        ourBufferRef.current.push({
          missionId,
          screenId: lastScreen,
          type: signal === "gave_up" ? "give_up" : "end",
          xNorm: 0,
          yNorm: 0,
          timestampMs: Math.round(now() - startTimeRef.current),
        })
      }
      // No sucesso, dá um respiro (~1,2s) entre o clique-objetivo e o feedback,
      // para não trocar de tela bruscamente. Na desistência, imediato.
      if (signal === "reached") setTimeout(() => setCompletion("reached"), 600)
      else setCompletion("gave_up")
      flush()
      if (preview) return
      fetch("/api/t/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          missionId,
          signal,
          outcome, // classificação do cliente (caminho exato): direct | indirect
          path: pathRef.current,
          durationMs: Math.round(now() - startTimeRef.current),
          misclickCount: misclickCountRef.current,
          clickCount: clickCountRef.current,
        }),
        keepalive: true,
      }).catch(() => {})
    },
    [flush, token, preview]
  )

  // Continua da tela de conclusão para o próximo passo (pergunta ou missão).
  const continueFromCompletion = useCallback(() => {
    setCompletion(null)
    advance()
  }, [advance])

  // SUM: grava o ASQ da tarefa (coletado no feedback de conclusão) e segue.
  const continueWithSum = useCallback(
    (missionId: string) => {
      if (!preview && sumValues.every((v) => v >= 1)) {
        fetch("/api/t/sum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, missionId, values: sumValues }),
          keepalive: true,
        }).catch(() => {})
      }
      setSumValues([0, 0, 0])
      setCompletion(null)
      advance()
    },
    [sumValues, token, advance, preview]
  )

  // Continua a partir do feedback de sucesso quando a próxima pergunta é de
  // estrelas: grava a nota dada ali mesmo e pula o step da pergunta.
  const continueWithInlineRating = useCallback(
    (nextQ: StepQuestion) => {
      if (!preview && inlineRating > 0) {
        fetch("/api/t/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, questionId: nextQ.id, rating: inlineRating }),
          keepalive: true,
        }).catch(() => {})
      }
      setCompletion(null)
      setInlineRating(0)
      // pula a missão atual E a pergunta de estrelas (já respondida aqui)
      const skipTo = stepIndex + 2
      if (skipTo > steps.length - 1) {
        finishFlow()
      } else {
        setStepIndex(skipTo)
        setTaskStarted(false)
        startedRef.current = false
      }
    },
    [inlineRating, token, stepIndex, steps.length, finishFlow, preview]
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

      // protótipo pronto → esconde o loader
      if (d.type === "INITIAL_LOAD") setEmbedLoaded(true)

      if (!startedRef.current || !missionRef.current) return
      const missionId = missionRef.current
      const ts = Math.round(now() - startTimeRef.current)

      // Registra um clique (na tela de origem) uma única vez, a partir de um
      // press pendente. Usado tanto no pareamento press/release (toque na mesma
      // tela) quanto na navegação (o press que disparou a troca de tela).
      type Press = {
        x: number
        y: number
        ox: number
        oy: number
        handled: boolean
        acted?: boolean
        counted?: boolean
        timer?: ReturnType<typeof setTimeout>
        nodeId: string | undefined
        sfId: string | undefined
      }
      // Hotspot do Beacon sob o clique. Os hotspots são desenhados sobre a
      // imagem INTEIRA da tela, então o teste usa a posição no CONTEÚDO:
      // origem do frame rolável + posição no viewport + offset de scroll.
      const hotspotUnder = (p: Press) => {
        const scr0 = p.nodeId ? screenByNode[p.nodeId] : undefined
        const geom0 = p.nodeId && p.sfId ? scrollFrameGeomByScreen[p.nodeId]?.[p.sfId] : undefined
        return scr0 && p.nodeId
          ? hotspotAt(
              clickContentPoint({ vx: p.x, vy: p.y, ox: p.ox, oy: p.oy }, scr0, geom0),
              hotspotsByNode[p.nodeId]
            )
          : undefined
      }
      // Manda o protótipo executar a ação do hotspot (uma vez por clique) e liga
      // o sinal de "navegando" até a nova tela aparecer.
      const actOnHotspot = (p: Press, hit: NonNullable<ReturnType<typeof hotspotUnder>>) => {
        if (p.acted || p.handled) return
        p.acted = true
        if (!runEmbedHotspotAction(iframeRef.current, hit)) return
        setNavigating(true)
        if (navTimerRef.current) clearTimeout(navTimerRef.current)
        navTimerRef.current = setTimeout(() => setNavigating(false), 2500)
      }
      const isGoalHotspot = (id: string) => (goalHotspotsByMission[missionId] ?? []).includes(id)

      const countClick = (p: Press) => {
        clickCountRef.current += 1
        if (!interactedRef.current) {
          interactedRef.current = true
          setInteracted(true)
        }
        const hit = hotspotUnder(p)
        // clique num hotspot do Beacon é um clique válido, mesmo que o Figma não
        // tenha interação ali
        const handled = p.handled || !!hit
        if (!handled) misclickCountRef.current += 1
        // Posição na tela = ORIGEM do frame rolável (normalizada) + posição do clique
        // no viewport do frame. Assim cliques dentro de carrossel/sub-frame rolável
        // caem no lugar certo (a posição vem relativa ao frame interno, não à tela).
        // Frame não-rolável → origem (0,0) = comportamento normal.
        const scr = p.nodeId ? screenByNode[p.nodeId] : undefined
        if (scr) {
          const geom = p.nodeId && p.sfId ? scrollFrameGeomByScreen[p.nodeId]?.[p.sfId] : undefined
          const xr = (geom?.x ?? 0) + p.x / (scr.w || 1)
          const yr = (geom?.y ?? 0) + p.y / (scr.h || 1)
          // descarta só o que cai claramente fora da tela (evita pilha nas bordas)
          if (xr >= -0.05 && xr <= 1.05 && yr >= -0.05 && yr <= 1.05) {
            ourBufferRef.current.push({
              missionId,
              screenId: scr.id,
              type: handled ? "click" : "misclick",
              xNorm: clamp01(xr),
              yNorm: clamp01(yr),
              hotspotId: hit?.id ?? null,
              timestampMs: ts,
            })
          }
        }
        // Critério "clique em hotspot": clicou num hotspot-objetivo → concluiu.
        if (hit && isGoalHotspot(hit.id)) {
          completeMission("reached", "direct")
        } else if (hit) {
          // Hotspot do Beacon onde o Figma não tem interação: o Beacon navega o
          // protótipo (ir para a tela de destino / voltar). Se o Figma já tratou
          // o clique, a interação do Figma prevalece. (Com mouse isso já
          // aconteceu no pressionar — actOnHotspot não repete.)
          actOnHotspot(p, hit)
        }
      }

      if (d.type === "MOUSE_PRESS_OR_RELEASE") {
        // Posição do clique no VIEWPORT do frame rolável mais próximo (não somamos o
        // offset de scroll — a posição já é relativa ao viewport). A origem do frame
        // na tela é somada depois, no countClick, via scrollFrameGeomByNode[sfId].
        const sfPos = d.data?.nearestScrollingFrameMousePosition as { x: number; y: number } | null
        const pos =
          sfPos ??
          (d.data?.targetNodeMousePosition as { x: number; y: number } | null) ?? { x: 0, y: 0 }
        const px = pos.x ?? 0
        const py = pos.y ?? 0
        const off = (d.data?.nearestScrollingFrameOffset as { x?: number; y?: number } | null) ?? null
        const sfId = d.data?.nearestScrollingFrameId as string | undefined
        const tNow = now()
        const pending = pendingPressRef.current

        // "release" que chega logo após um clique já contado na navegação → ignora
        if (!pending && tNow - postNavRef.current < 250) {
          return
        }

        // O Figma manda UM evento por clique. Cada evento é um clique, salvo se
        // outro chegar logo em seguida em outra posição (fim de um arraste).
        const countOnce = (p: Press) => {
          if (p.counted) return
          p.counted = true
          countClick(p)
        }
        if (pending && tNow - pending.t < CLICK_PAIR_MS) {
          // 2º evento do MESMO gesto: longe = arraste (não é clique); perto = o
          // mesmo clique, que conta uma vez só.
          pendingPressRef.current = null
          if (pending.timer) clearTimeout(pending.timer)
          const moved = Math.abs(px - pending.x) > DRAG_PX || Math.abs(py - pending.y) > DRAG_PX
          if (!moved) countOnce(pending)
          return
        }
        if (pending) {
          // o anterior ficou sozinho → era um clique (em toque o timer já contou)
          if (pending.timer) clearTimeout(pending.timer)
          countOnce(pending)
        }
        const press: NonNullable<typeof pendingPressRef.current> = {
          t: tNow,
          x: px,
          y: py,
          ox: off?.x ?? 0,
          oy: off?.y ?? 0,
          handled: d.data?.handled !== false,
          nodeId: d.data?.presentedNodeId as string | undefined,
          sfId,
        }
        pendingPressRef.current = press
        if (actsOnPress()) {
          // mouse/trackpad: não existe arraste para rolar → o clique vale na hora
          // (conclui a tarefa / navega sem esperar nada).
          countOnce(press)
        } else {
          // toque: espera o suficiente para descartar um arraste (rolagem) e conta
          press.timer = setTimeout(() => {
            if (missionRef.current === missionId) countOnce(press)
          }, CLICK_PAIR_MS)
        }
      }

      if (d.type === "PRESENTED_NODE_CHANGED") {
        setNavigating(false) // a nova tela apareceu
        const nodeId = d.data?.presentedNodeId as string | undefined
        const scr = nodeId ? screenByNode[nodeId] : undefined
        if (scr) {
          const changed = pathRef.current[pathRef.current.length - 1] !== scr.id
          if (changed) {
            // o press pendente foi o clique que disparou esta navegação → conta
            // na tela de ORIGEM (antes de empurrar a nova tela no caminho).
            const pp = pendingPressRef.current
            if (pp) {
              if (pp.timer) clearTimeout(pp.timer)
              if (!pp.counted) {
                pp.counted = true
                countClick(pp)
              }
              pendingPressRef.current = null
              postNavRef.current = now()
            }
            pathRef.current.push(scr.id)
            ourBufferRef.current.push({
              missionId,
              screenId: scr.id,
              type: "navigate",
              targetScreenId: scr.id,
              xNorm: 0,
              yNorm: 0,
              timestampMs: ts,
            })
          }

          if (successTypeByMission[missionId] === "path") {
            // CAMINHO EXATO: o SUCESSO exige PERCORRER o caminho definido em ordem
            // — TODAS as telas do caminho, incluindo a(s) tela(s)-chave (ex.: a
            // "Cerca de subir - Listagem"), terminando na tela-objetivo. Assim:
            //  • Direto   = percorreu um caminho exato limpo, sem telas extras.
            //  • Indireto = passou por todas as telas do caminho, na ordem, mas com
            //               desvios/telas extras no meio (abriu filtro, foi a outra
            //               tela e voltou…). Ainda percorreu a tela-chave.
            //  • Não conta = chegou na tela-objetivo SEM percorrer o caminho (pulou
            //               a tela-chave) → não é sucesso; conta como não concluído.
            // Cada tela avança a subsequência de cada caminho esperado; desvio marca
            // "não limpo". Conclui quando algum caminho é percorrido por inteiro;
            // preferimos DIRETO se algum caminho foi percorrido limpo.
            if (changed) {
              let reachedGoal = false
              let directHit = false
              for (const m of matchRef.current) {
                if (m.steps.length < 2) continue
                if (m.len < m.steps.length) {
                  // tenta casar a tela atual, pulando passos OPCIONAIS que ela não
                  // casa (ex.: o testador não abriu o perfil e foi direto ao objetivo).
                  let advanced = false
                  while (m.len < m.steps.length) {
                    const step = m.steps[m.len]
                    if (step.ids.includes(scr.id)) {
                      m.len++
                      advanced = true
                      break
                    }
                    if (step.optional) {
                      m.len++ // pula o opcional e testa o próximo passo com a mesma tela
                      continue
                    }
                    break // passo obrigatório não casou → é tela extra/desvio
                  }
                  if (!advanced && m.len < m.steps.length) m.clean = false
                }
                if (m.len === m.steps.length) {
                  reachedGoal = true
                  if (m.clean) directHit = true
                }
              }
              if (reachedGoal) completeMission("reached", directHit ? "direct" : "indirect")
            }
          } else {
            // TELA-ALVO: chegar na tela objetivo por qualquer caminho = sucesso.
            const goals = goalsByMission[missionId] ?? []
            if (nodeId && goals.includes(nodeId)) {
              const atStart = startNodeRef.current === nodeId && pathRef.current.length <= 1
              if (!atStart) completeMission("reached", "direct")
            }
          }
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
      if (preview || bufferRef.current.length === 0) return
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
  }, [flush, token, preview])

  function startTask() {
    if (!mission) return
    completedRef.current = false
    startTimeRef.current = now()
    clickCountRef.current = 0
    misclickCountRef.current = 0
    interactedRef.current = false
    setInteracted(false)
    pathRef.current = mission.startScreenId ? [mission.startScreenId] : []
    missionRef.current = mission.id
    startNodeRef.current = currentStartNode
    pendingPressRef.current = null
    postNavRef.current = 0
    setSumValues([0, 0, 0])
    // inicializa o rastreador do caminho exato (início já conta como 1º passo)
    matchRef.current = (expectedPathsByMission[mission.id] ?? []).map((steps) => ({
      steps,
      len: steps[0]?.ids.includes(mission.startScreenId) ? 1 : 0,
      clean: true,
    }))
    startedRef.current = true
    // navigate inicial: marca o início da tarefa na tela inicial e persiste já
    // (permite distinguir "iniciou e sumiu" = perdida de "nunca iniciou").
    if (mission.startScreenId) {
      ourBufferRef.current.push({
        missionId: mission.id,
        screenId: mission.startScreenId,
        type: "navigate",
        targetScreenId: mission.startScreenId,
        xNorm: 0,
        yNorm: 0,
        timestampMs: 0,
      })
    }
    flush()
    setTaskStarted(true)
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
          body: JSON.stringify({ token, questionId: (step.question as StepQuestion).id, ...payload }),
          keepalive: true,
        })
      } catch {
        /* segue */
      }
    }
    advance()
  }

  function submitSus(values: number[]) {
    if (!preview) {
      fetch("/api/t/sus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, values }),
        keepalive: true,
      }).catch(() => {})
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
  } else if (howItWorks && !introDone) {
    content = <HowItWorksScreen text={howItWorks} lang={lang} onContinue={() => setIntroDone(true)} />
  } else if (finished || !step) {
    content = (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant p-12 text-center space-y-2">
          <h1 className="text-headline-small text-on-surface whitespace-pre-wrap">
            {thanksTitle?.trim() || s.thanksTitle}
          </h1>
          <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">
            {thanksMessage?.trim() || s.thanksBody}
          </p>
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
          deviceType={deviceType}
          stepLabel={s.stepOf(stepIndex + 1, steps.length)}
          onSubmit={submitAnswer}
        />
      </div>
    )
  } else if (step.kind === "sus") {
    content = <SusView lang={lang} statements={susStatements} onSubmit={submitSus} />
  } else {
    // Missão: tarefa à esquerda, protótipo VIVO à direita. Ao concluir, o painel
    // esquerdo vira o feedback (com botão continuar) e o protótipo some.
    const reached = completion === "reached"

    // Feedback de conclusão (sucesso/desistência + SUM + estrelas + continuar).
    const feedbackInner = (
      <>
        <div
          className={
            "inline-flex h-14 w-14 items-center justify-center rounded-2xl " +
            (reached
              ? "bg-emerald-600 text-white"
              : "bg-surface-container-high text-on-surface-variant")
          }
        >
          {reached ? <Check className="h-7 w-7" /> : <Flag className="h-7 w-7" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-headline-medium text-on-surface">
            {reached ? s.taskDoneTitle : s.taskGaveUpTitle}
          </h1>
          <p className="text-body-large text-on-surface-variant">
            {reached ? s.taskDoneBody : s.taskGaveUpBody}
          </p>
        </div>

        {/* SUM: ASQ (3 perguntas 1..7) embutido no feedback da tarefa */}
        {sumEnabled && (
          <div className="space-y-5 pt-1">
            {(sumStatements ?? []).map((st, idx) => (
              <SeqScale
                key={idx}
                statement={st}
                value={sumValues[idx] ?? 0}
                onChange={(v) =>
                  setSumValues((prev) => prev.map((p, j) => (j === idx ? v : p)))
                }
                anchors={sumAnchors ?? { low: "", high: "" }}
              />
            ))}
          </div>
        )}

        {/* Pergunta de estrelas embutida (próximo passo) — poupa 1 clique.
            Só quando a SUM não está embutida aqui (evita dois inline). */}
        {!sumEnabled && inlineRatingQ && (
          <div className="space-y-2.5 pt-1">
            <p className="text-title-medium text-on-surface">{inlineRatingQ.title}</p>
            {inlineRatingQ.description && (
              <p className="text-body-medium text-on-surface-variant">
                {inlineRatingQ.description}
              </p>
            )}
            <div className="flex items-center gap-2.5 pt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInlineRating(n)}
                  aria-label={`${n}`}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      "h-12 w-12 transition-colors",
                      n <= inlineRating ? "text-amber-400" : "text-outline-variant"
                    )}
                    fill={n <= inlineRating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <p className="text-body-small text-on-surface-variant">{s.rateHint}</p>
          </div>
        )}

        {sumEnabled ? (
          <Button
            onClick={() => continueWithSum(step.mission.id)}
            disabled={!sumAnswered}
            className="h-12 px-6"
            size="lg"
          >
            {s.continue}
          </Button>
        ) : inlineRatingQ ? (
          <Button
            onClick={() => continueWithInlineRating(inlineRatingQ)}
            disabled={inlineRatingQ.required && inlineRating === 0}
            className="h-12 px-6"
            size="lg"
          >
            {s.continue}
          </Button>
        ) : (
          <Button onClick={continueFromCompletion} className="h-12 px-6" size="lg">
            {s.continue}
          </Button>
        )}
      </>
    )

    // Briefing (pré-início): rótulo do passo, tarefa, descrição e "Iniciar tarefa".
    const briefingInner = (
      <>
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
        {!taskStarted && (
          <Button onClick={startTask} className="h-12 px-6" size="lg">
            <Play className="h-4 w-4 mr-2" />
            {s.startTask}
          </Button>
        )}
      </>
    )

    // Quadro do protótipo (iframe do embed + loader). Reutilizado nos dois layouts.
    const protoBox = (
      <div
        className={
          "relative bg-white overflow-hidden transition-opacity duration-300 max-w-full " +
          // mobile: quadro de celular (retrato, altura fixa, cantos arredondados).
          // web/tablet: tamanho de teste definido pela TELA (ver style abaixo).
          (isMobile ? "rounded-[28px] h-[90vh] " : "rounded-xl shadow-sm ") +
          (!taskStarted ? "opacity-40 pointer-events-none select-none" : "")
        }
        style={
          isMobile
            ? { aspectRatio: layout.aspect }
            : {
                // Web/tablet: o quadro NÃO usa o tamanho em pixels do protótipo.
                // Assume a proporção do frame (ou do viewport, se a página for
                // longa) e ocupa o MAIOR tamanho que cabe na área (limite de 88vh
                // de altura e 100% da largura), centralizado.
                aspectRatio: layout.aspect,
                width: `min(100%, calc(88vh * ${layout.aspect}))`,
                maxHeight: "88vh",
              }
        }
        aria-hidden={!taskStarted}
      >
        {embedSrc && (
          /* Recorte da moldura do Figma: o iframe fica maior que o quadro e
             centralizado, e o overflow-hidden do quadro corta a borda preta
             do device frame. FRAME_CROP=1 desliga o recorte. */
          <iframe
            ref={iframeRef}
            title="Protótipo"
            src={embedSrc}
            allowFullScreen
            loading="eager"
            style={{
              position: "absolute",
              width: `${FRAME_CROP * 100}%`,
              height: `${FRAME_CROP * 100}%`,
              left: `${-(FRAME_CROP - 1) * 50}%`,
              top: `${-(FRAME_CROP - 1) * FRAME_CROP_TOP * 100}%`,
              border: "none",
              display: "block",
            }}
          />
        )}

        {/* Clique num hotspot reconhecido: barra no topo até a nova tela aparecer */}
        {navigating && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-primary/20">
            <div className="h-full w-full origin-left animate-pulse bg-primary" />
          </div>
        )}

        {/* Loader amigável (barrinha que enche) enquanto o Figma carrega */}
        {!embedLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-container-low px-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div className="w-full max-w-[200px] h-2 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
                style={{ width: loadProgress + "%" }}
              />
            </div>
            <span className="text-title-medium text-on-surface">{s.loadingPrototype}</span>
          </div>
        )}
      </div>
    )

    content = isMobile ? (
      // ─── MOBILE — layout dividido (tarefa | protótipo). Inalterado. ───
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col px-6 py-10 md:px-12 lg:px-16 bg-surface">
          <div className="flex-1 flex flex-col justify-center">
            <div className="w-full max-w-md md:ml-auto md:mr-8 space-y-6">
              {completion ? feedbackInner : briefingInner}
            </div>
          </div>

          {/* Desistir — aparece (fade) após o 1º clique, sem empurrar o texto. */}
          {!completion && taskStarted && (
            <div className="w-full max-w-md md:ml-auto md:mr-8 pt-6">
              <Button
                variant="outline"
                size="lg"
                className={
                  "h-12 px-6 transition-opacity duration-700 " +
                  (interacted ? "opacity-100" : "opacity-0 pointer-events-none")
                }
                onClick={() => completeMission("gave_up")}
              >
                <Flag className="h-4 w-4 mr-2" />
                {s.giveUp}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center p-2 md:p-3 bg-surface-container overflow-hidden md:h-screen">
          {!completion && protoBox}
        </div>
      </div>
    ) : completion ? (
      // ─── WEB — feedback de conclusão, centralizado (protótipo some) ───
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-container overflow-y-auto">
        <div className="w-full max-w-md my-8 space-y-6 rounded-[28px] border border-outline-variant bg-surface-container-low elevation-1 p-10">
          {feedbackInner}
        </div>
      </div>
    ) : (
      // ─── WEB — protótipo em tela cheia + tarefa como widget flutuante ───
      <div className="relative min-h-screen md:h-screen overflow-hidden bg-surface-container">
        {/* Protótipo centralizado, ocupando a tela */}
        <div className="absolute inset-0 flex items-center justify-center p-3 md:p-6">
          {protoBox}
        </div>

        {/* Briefing (pré-início): painel de ALTURA CHEIA encostado à esquerda,
            sobreposto ao protótipo (a imagem fica full por baixo, sem espremer).
            Desliza pra fora ao iniciar a tarefa. */}
        <div
          className={
            "absolute inset-y-0 left-0 z-40 flex w-[min(440px,90vw)] flex-col justify-center border-r border-outline-variant bg-surface px-8 py-10 shadow-[4px_0_24px_rgba(0,0,0,0.06)] transition-transform duration-500 ease-out lg:px-12 " +
            (taskStarted ? "-translate-x-full pointer-events-none" : "translate-x-0")
          }
        >
          <div className="w-full space-y-6">{briefingInner}</div>
        </div>

        {/* Tarefa como widget flutuante arrastável — durante a tarefa */}
        {taskStarted && (
          <FloatingTaskWidget
            stepLabel={s.stepOf(stepIndex + 1, steps.length)}
            title={step.mission.task}
            description={step.mission.description}
            showLabel={s.showInstructions}
            hideLabel={s.hideInstructions}
            giveUpLabel={s.giveUp}
            onGiveUp={() => completeMission("gave_up")}
          />
        )}
      </div>
    )
  }

  return (
    <>
      {/* acelera o 1º carregamento do embed abrindo a conexão com o Figma antes */}
      <link rel="preconnect" href="https://embed.figma.com" />
      <link rel="preconnect" href="https://www.figma.com" />
      {content}
    </>
  )
}
