// Monta, a partir das telas e missões do estudo, os mapas que o runner do
// protótipo VIVO do Figma consome (node-id do Figma ↔ tela do Beacon). Usado
// pelo link do testador e pela revisão, para os dois rodarem o MESMO fluxo.
import { type PathStepDef } from "@/lib/path"

interface RunnerScreen {
  id: string
  figmaNodeId: string | null
  width: number
  height: number
  scrollFrames: unknown
  hotspots?: {
    id: string
    coords: unknown
    action?: "navigate" | "open_overlay" | "close_overlay" | "back"
    targetScreenId?: string | null
  }[]
}

/** Hotspot do Beacon numa tela do Figma: área + o que fazer no embed ao clicar. */
export type RunnerHotspot = { id: string } & Geom & {
  action: "navigate" | "open_overlay" | "close_overlay" | "back"
  targetNodeId: string | null
}

interface RunnerMission {
  id: string
  startScreenId: string
  goalScreenIds: string[]
  successType: "screen" | "path" | "hotspot"
  goalHotspotIds?: string[]
  paths: PathStepDef[][]
}

type Geom = { x: number; y: number; w: number; h: number }

export function buildFigmaRunnerMaps(screens: RunnerScreen[], missions: RunnerMission[]) {
  // figmaNodeId → tela (id + tamanho)
  const screenByNode: Record<string, { id: string; w: number; h: number }> = {}
  const screenToNode: Record<string, string> = {}
  // figmaNodeId da tela → { figmaNodeId do frame rolável → origem/tam } (p/ heatmap)
  const scrollFrameGeomByScreen: Record<string, Record<string, Geom>> = {}
  // figmaNodeId da tela → hotspots desenhados no Beacon (coords normalizadas na tela)
  const hotspotsByNode: Record<string, RunnerHotspot[]> = {}
  for (const sc of screens) if (sc.figmaNodeId) screenToNode[sc.id] = sc.figmaNodeId
  for (const sc of screens) {
    if (!sc.figmaNodeId) continue
    if (sc.hotspots?.length) {
      hotspotsByNode[sc.figmaNodeId] = sc.hotspots.map((h) => ({
        id: h.id,
        ...(h.coords as Geom),
        action: h.action ?? "navigate",
        targetNodeId: h.targetScreenId ? screenToNode[h.targetScreenId] ?? null : null,
      }))
    }
    screenByNode[sc.figmaNodeId] = { id: sc.id, w: sc.width, h: sc.height }
    screenToNode[sc.id] = sc.figmaNodeId
    const frames = (sc.scrollFrames as ({ figmaId: string } & Geom)[] | null) ?? []
    if (frames.length) {
      scrollFrameGeomByScreen[sc.figmaNodeId] = Object.fromEntries(
        frames.map((f) => [f.figmaId, { x: f.x, y: f.y, w: f.w, h: f.h }])
      )
    }
  }

  const goalsByMission: Record<string, string[]> = {}
  const startNodeByMission: Record<string, string | null> = {}
  const successTypeByMission: Record<string, "screen" | "path" | "hotspot"> = {}
  const goalHotspotsByMission: Record<string, string[]> = {}
  // Caminhos esperados (passos c/ opcional/wildcard) — rastreador do caminho exato
  const expectedPathsByMission: Record<string, PathStepDef[][]> = {}
  for (const m of missions) {
    goalsByMission[m.id] = m.goalScreenIds
      .map((gid) => screenToNode[gid])
      .filter((n): n is string => !!n)
    // frame de partida da missão (node-id do Figma), p/ o embed abrir ali
    startNodeByMission[m.id] = screenToNode[m.startScreenId] ?? null
    successTypeByMission[m.id] = m.successType
    goalHotspotsByMission[m.id] = m.goalHotspotIds ?? []
    expectedPathsByMission[m.id] = m.paths.filter((p) => p.length >= 2)
  }

  // dimensões de referência (1ª tela) — usadas quando a missão não tem frame de partida
  const refScreen = screens[0]
  return {
    screenByNode,
    scrollFrameGeomByScreen,
    goalsByMission,
    startNodeByMission,
    successTypeByMission,
    expectedPathsByMission,
    hotspotsByNode,
    goalHotspotsByMission,
    frameW: refScreen?.width || 360,
    frameH: refScreen?.height || 800,
  }
}
