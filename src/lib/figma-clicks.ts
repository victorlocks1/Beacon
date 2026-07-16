// Reproduz o pareamento press/release do runner (figma-flow-runner) para extrair,
// do log CRU do Figma (FigmaEventLog), os CLIQUES contados de uma sessão — com a
// posição no viewport do frame rolável E o offset de scroll. Isso permite calcular
// a posição do clique no CONTEÚDO (viewport + offset) para o heatmap "desenrolado".
//
// Mantém a MESMA lógica do runner (janela de 700ms, ignore de 250ms pós-navegação,
// descarte de arraste > 14px) — validado contra os Event reais com ~1,4% de desvio.

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
  isScreen: (nodeId: string) => boolean
): CountedClick[] {
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
      if (pending && tNow - pending.t < 700) {
        const p = pending
        pending = null
        if (Math.abs(px - p.x) > 14 || Math.abs(py - p.y) > 14) continue // arraste
        emit(p)
      } else {
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
  return out
}
