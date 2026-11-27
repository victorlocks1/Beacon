// Reproduz o pareamento press/release do runner (figma-flow-runner) para extrair,
// do log CRU do Figma (FigmaEventLog), os CLIQUES contados de uma sessão — com a
// posição no viewport do frame rolável E o offset de scroll. Isso permite calcular
// a posição do clique no CONTEÚDO (viewport + offset) para o heatmap "desenrolado".
//
// Mantém a MESMA lógica do runner (clique = evento isolado; janela de
// CLICK_PAIR_MS para detectar arraste; ignore de 250ms pós-navegação).

// O embed do Figma manda, na prática, UM evento MOUSE_PRESS_OR_RELEASE por
// clique (medido nos logs: ~68% dos eventos chegam isolados). Um segundo evento
// só aparece logo em seguida quando é o fim de um arraste (posição diferente)
// ou um eco do mesmo clique (mesma posição). Por isso: cada evento É um clique,
// a menos que outro chegue dentro de CLICK_PAIR_MS em outra posição (arraste).
export const CLICK_PAIR_MS = 350
export const DRAG_PX = 14
// Clique num hotspot que o Figma diz ter tratado mas sem nenhuma reação (troca
// de tela/estado) dentro deste prazo: o Beacon executa a ação do hotspot.
// Medido nos testes reais: quando o Figma navega, a troca de tela chega em até
// 20ms em 86% dos cliques e em até 60ms em 93%. Por isso a espera é mínima
// (imperceptível). "Voltar" espera um pouco mais: voltar duas vezes seria pior.
export function handledFallbackMs(action: string): number {
  return action === "back" || action === "close_overlay" ? 250 : 80
}
// tolerância: troca de tela registrada "um pouco antes" do clique (mesmo ms)
export const REACTION_SLACK_MS = 30

// ── Vigência das regras ──
// Números de testes já realizados NÃO são recalculados: cada sessão é lida com
// a regra que estava valendo quando ela aconteceu. Ao mudar uma regra de
// contagem, registre aqui a data em que a nova versão entrou no ar.
//
// Até esta data o runner exigia um PAR de eventos (≤700ms) para contar um clique
// e descartava os isolados; a partir dela, cada evento é um clique.
export const CLICK_RULE_V2_FROM = new Date("2026-10-09T13:38:55Z")
// A partir desta data, clique dentro de um hotspot do Beacon conta como clique
// (não misclick) mesmo sem interação no Figma.
export const HOTSPOT_RULE_FROM = new Date("2026-10-08T18:11:28Z")
const LEGACY_PAIR_MS = 700

type Pt = { x: number; y: number }
export type RawFigmaEvent = {
  type: string
  data: Record<string, unknown> | null
  clientTsMs: number
  missionId: string | null
}

export type CountedClick = {
  missionId: string | null
  presentedNode: string | undefined // figmaNodeId da tela apresentada
  scrollFrameId: string | undefined // nearestScrollingFrameId (frame rolável sob o clique)
  vx: number // posição no viewport do frame rolável (px)
  vy: number
  ox: number // offset de scroll (px)
  oy: number
  targetNode: string | undefined // targetNodeId (elemento clicado)
  tx: number // posição DENTRO do elemento clicado (px)
  ty: number
  handled: boolean
  tMs: number
}

function asPt(v: unknown): Pt | null {
  if (v && typeof v === "object" && "x" in v && "y" in v) {
    const o = v as { x?: unknown; y?: unknown }
    return { x: Number(o.x ?? 0), y: Number(o.y ?? 0) }
  }
  return null
}

/**
 * @param events  eventos crus de UMA sessão, em ordem de clientTsMs
 * @param isScreen figmaNodeId → é uma tela conhecida? (para detectar navegação)
 */
export function extractCountedClicks(
  events: RawFigmaEvent[],
  isScreen: (nodeId: string) => boolean,
  // true = sessão anterior a CLICK_RULE_V2_FROM: reproduz a regra antiga (par de
  // eventos; isolados descartados), para o relatório bater com o que foi gravado.
  opts: { legacyPairing?: boolean } = {}
): CountedClick[] {
  const legacy = !!opts.legacyPairing
  const pairMs = legacy ? LEGACY_PAIR_MS : CLICK_PAIR_MS
  const out: CountedClick[] = []
  type Pending = {
    t: number
    x: number
    y: number
    ox: number
    oy: number
    tgt: string | undefined
    tx: number
    ty: number
    handled: boolean
    nodeId: string | undefined
    sfId: string | undefined
    m: string | null
  }
  let pending: Pending | null = null
  let postNav = 0
  let lastPresented: string | undefined = undefined
  let curMission: string | null | undefined = undefined

  const emit = (p: Pending) =>
    out.push({
      missionId: p.m,
      presentedNode: p.nodeId,
      scrollFrameId: p.sfId,
      vx: p.x,
      vy: p.y,
      ox: p.ox,
      oy: p.oy,
      targetNode: p.tgt,
      tx: p.tx,
      ty: p.ty,
      handled: p.handled,
      tMs: p.t,
    })

  for (const e of events) {
    // estado reseta por missão (igual ao runner ao trocar de tarefa)
    if (e.missionId !== curMission) {
      if (pending && !legacy) emit(pending) // clique isolado ainda em aberto
      curMission = e.missionId
      pending = null
      postNav = 0
      lastPresented = undefined
    }
    if (!e.missionId) continue
    const d = e.data ?? {}

    if (e.type === "MOUSE_PRESS_OR_RELEASE") {
      const sfPos = asPt(d.nearestScrollingFrameMousePosition)
      const tgtPos = asPt(d.targetNodeMousePosition)
      const pos = sfPos ?? tgtPos ?? { x: 0, y: 0 }
      const off = asPt(d.nearestScrollingFrameOffset) ?? { x: 0, y: 0 }
      const px = pos.x
      const py = pos.y
      const sfId = (d.nearestScrollingFrameId as string | undefined) || undefined
      const presentedId = (d.presentedNodeId as string | undefined) || undefined
      const tgtId = (d.targetNodeId as string | undefined) || undefined
      const handled = d.handled !== false
      const tNow = e.clientTsMs

      if (!pending && tNow - postNav < 250) continue
      if (pending && tNow - pending.t < pairMs) {
        // 2º evento do MESMO gesto: longe = arraste (não é clique); perto = o
        // mesmo clique (conta uma vez).
        const p = pending
        pending = null
        if (Math.abs(px - p.x) > DRAG_PX || Math.abs(py - p.y) > DRAG_PX) continue
        emit(p)
        continue
      }
      if (pending && !legacy) emit(pending) // o anterior ficou sozinho → era um clique
      pending = {
        t: tNow,
        x: px,
        y: py,
        ox: off.x,
        oy: off.y,
        tgt: tgtId,
        tx: tgtPos?.x ?? px,
        ty: tgtPos?.y ?? py,
        handled,
        nodeId: presentedId,
        sfId,
        m: e.missionId,
      }
    } else if (e.type === "PRESENTED_NODE_CHANGED") {
      const nodeId = (d.presentedNodeId as string | undefined) || undefined
      if (nodeId && isScreen(nodeId)) {
        const changed = lastPresented !== nodeId
        if (changed) {
          if (pending) {
            emit(pending)
            pending = null
            postNav = e.clientTsMs
          }
          lastPresented = nodeId
        }
      }
    }
  }
  if (pending && !legacy) emit(pending) // último clique isolado
  return out
}

// ---------------------------------------------------------------------------
// Hotspots do Beacon sob um clique do embed. É a MESMA regra usada pelo runner
// (ao gravar o clique) e pelos relatórios que releem o log cru — assim um clique
// num hotspot é "clique" (e não misclick) em todos os lugares.
// ---------------------------------------------------------------------------
export type HotspotRect = { id: string; x: number; y: number; w: number; h: number }

/**
 * Posição do clique na tela INTEIRA (normalizada 0..1), em coordenadas de
 * conteúdo: origem do frame rolável + posição no viewport + offset de scroll.
 * Os hotspots são desenhados sobre a imagem inteira da tela, então é nesse
 * sistema que o teste de acerto precisa ser feito.
 */
export function clickContentPoint(
  click: { vx: number; vy: number; ox: number; oy: number },
  screen: { w: number; h: number },
  frameOrigin?: { x: number; y: number } | null
): { x: number; y: number } {
  return {
    x: (frameOrigin?.x ?? 0) + (click.vx + click.ox) / (screen.w || 1),
    y: (frameOrigin?.y ?? 0) + (click.vy + click.oy) / (screen.h || 1),
  }
}

// A partir desta data, clique em elemento FIXO (barra de abas, cabeçalho) é
// localizado na posição de design do elemento (onde o hotspot foi desenhado),
// e não na posição de conteúdo. Sessões anteriores seguem a regra antiga.
export const FIXED_RULE_FROM = new Date("2026-11-27T20:30:00Z")

/**
 * Mapa nó → origem normalizada de DESIGN. [x,y] = nó dentro de elemento fixo
 * (barra de abas); [x,y,0] = nó dentro de uma área com interação do Figma.
 */
export type FixedBoxes = Record<string, [number, number] | [number, number, 0]>

/**
 * Posição do clique na tela (0..1) para teste de hotspot. Se o elemento clicado
 * é FIXO no protótipo (fica preso ao viewport enquanto a tela rola), usa a origem
 * de design do elemento + a posição do clique dentro dele — é onde o hotspot foi
 * desenhado. Caso contrário, coordenada de conteúdo (clickContentPoint).
 */
export function clickScreenPoint(
  click: { vx: number; vy: number; ox: number; oy: number; targetNode?: string; tx?: number; ty?: number },
  screen: { w: number; h: number },
  frameOrigin?: { x: number; y: number } | null,
  fixedBoxes?: FixedBoxes | null
): { x: number; y: number } {
  const fb = click.targetNode ? fixedBoxes?.[click.targetNode] : undefined
  if (fb) {
    return {
      x: fb[0] + (click.tx ?? 0) / (screen.w || 1),
      y: fb[1] + (click.ty ?? 0) / (screen.h || 1),
    }
  }
  return clickContentPoint(click, screen, frameOrigin)
}

/** Hotspot que contém o ponto (o desenhado por último vence, como no player). */
export function hotspotAt<T extends HotspotRect>(
  pt: { x: number; y: number },
  hotspots: T[] | undefined
): T | undefined {
  if (!hotspots?.length) return undefined
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const h = hotspots[i]
    if (pt.x >= h.x && pt.x <= h.x + h.w && pt.y >= h.y && pt.y <= h.y + h.h) return h
  }
  return undefined
}
