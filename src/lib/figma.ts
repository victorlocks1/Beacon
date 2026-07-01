// Cliente REST do Figma + parser de protótipo → estrutura que o motor do
// Beacon consome (telas + hotspots + regiões fixas/scroll). Sem dependência
// nova: usa fetch. As funções "puras" (index/extract) são separadas da rede
// para permitir teste offline contra um arquivo já baixado.

const FIGMA_API = "https://api.figma.com"

// ---------------------------------------------------------------------------
// Tipos do nosso plano de importação (independem do shape cru do Figma)
// ---------------------------------------------------------------------------
export type ImportAction = "navigate" | "open_overlay" | "close_overlay" | "back"
export interface ImportHotspot {
  coords: { x: number; y: number; w: number; h: number }
  action: ImportAction
  overlayPosition: "bottom" | "center" | null
  destFigmaId: string | null
}
export interface ImportRegion {
  kind: "fixed" | "scroll"
  coords: { x: number; y: number; w: number; h: number }
  axis: "horizontal" | "vertical" | "both"
}
export interface ImportScreen {
  figmaId: string
  name: string
  width: number
  height: number
  scroll: "none" | "vertical" | "horizontal" | "both"
  isStart: boolean
  hotspots: ImportHotspot[]
  regions: ImportRegion[]
  thumbUrl?: string
}

// shape cru mínimo de um nó do Figma (o que usamos)
interface FigNode {
  id: string
  name: string
  type: string
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null
  overflowDirection?: string
  scrollBehavior?: string
  overlayPositionType?: string
  transitionNodeID?: string | null
  interactions?: Array<{ trigger?: { type?: string } | null; actions?: Array<Record<string, unknown>> }>
  children?: FigNode[]
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------
export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string | null } {
  // aceita /file/, /design/, /proto/
  const keyMatch = url.match(/figma\.com\/(?:file|design|proto)\/([A-Za-z0-9]+)/)
  if (!keyMatch) throw new Error("URL do Figma inválida — esperado um link de arquivo, design ou protótipo.")
  const fileKey = keyMatch[1]

  let nodeId: string | null = null
  const u = safeUrl(url)
  if (u) {
    // prioriza o ponto de início do protótipo, senão o node selecionado
    const raw =
      u.searchParams.get("starting-point-node-id") ||
      u.searchParams.get("node-id")
    if (raw) nodeId = raw.replace(/-/g, ":") // URL usa "-", API usa ":"
  }
  return { fileKey, nodeId }
}

function safeUrl(s: string): URL | null {
  try {
    return new URL(s)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------
async function figmaApi<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.err || body?.message || ""
    } catch {
      /* ignore */
    }
    throw new Error(`Figma API ${res.status}${detail ? `: ${detail}` : ""}`)
  }
  return res.json() as Promise<T>
}

export async function figmaGetMe(token: string): Promise<{ id: string; handle: string }> {
  return figmaApi(token, "/v1/me")
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function figmaGetNodes(
  token: string,
  fileKey: string,
  ids: string[]
): Promise<Record<string, FigNode>> {
  const result: Record<string, FigNode> = {}
  for (const part of chunk(ids, 40)) {
    const q = encodeURIComponent(part.join(","))
    const data = await figmaApi<{ nodes: Record<string, { document: FigNode } | null> }>(
      token,
      `/v1/files/${fileKey}/nodes?ids=${q}`
    )
    for (const [id, entry] of Object.entries(data.nodes || {})) {
      if (entry?.document) result[id] = entry.document
    }
  }
  return result
}

export async function figmaGetImages(
  token: string,
  fileKey: string,
  ids: string[],
  opts: { scale?: number; format?: "png" | "jpg" | "svg" } = {}
): Promise<Record<string, string>> {
  const scale = opts.scale ?? 2
  const format = opts.format ?? "png"
  const out: Record<string, string> = {}
  for (const part of chunk(ids, 40)) {
    const q = encodeURIComponent(part.join(","))
    const data = await figmaApi<{ images: Record<string, string | null>; err?: string }>(
      token,
      `/v1/images/${fileKey}?ids=${q}&scale=${scale}&format=${format}`
    )
    for (const [id, url] of Object.entries(data.images || {})) {
      if (url) out[id] = url
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Index + funções puras de extração (testáveis sem rede)
// ---------------------------------------------------------------------------
type Index = { byId: Record<string, FigNode>; parentOf: Record<string, string | null> }

export function indexTree(root: FigNode, idx: Index, parentId: string | null = null) {
  idx.byId[root.id] = root
  idx.parentOf[root.id] = parentId
  for (const c of root.children || []) indexTree(c, idx, root.id)
}

// sobe até o frame de topo (cujo pai é CANVAS/SECTION ou inexistente)
export function screenIdOf(nodeId: string, idx: Index): string {
  let cur = nodeId
  for (let i = 0; i < 100; i++) {
    const parentId = idx.parentOf[cur]
    if (parentId == null) return cur
    const parent = idx.byId[parentId]
    if (!parent || parent.type === "CANVAS" || parent.type === "SECTION") return cur
    cur = parentId
  }
  return cur
}

const CLICK_TRIGGERS = new Set(["ON_CLICK", "ON_PRESS", "ON_TAP", "MOUSE_DOWN", "MOUSE_UP"])

// edges de protótipo de UM nó (1 hotspot por nó: pega a 1ª ação mapeável)
function edgeForNode(n: FigNode): { action: ImportAction; dest: string | null } | null {
  if (Array.isArray(n.interactions) && n.interactions.length) {
    for (const it of n.interactions) {
      if (!it || !CLICK_TRIGGERS.has(it.trigger?.type ?? "")) continue
      for (const a of it.actions || []) {
        if (!a) continue
        const type = a.type as string
        if (type === "BACK") return { action: "back", dest: null }
        if (type === "CLOSE") return { action: "close_overlay", dest: null }
        if (type === "NODE") {
          const nav = a.navigation as string
          const dest = (a.destinationId as string) || null
          if (nav === "NAVIGATE" || nav === "SWAP") return { action: "navigate", dest }
          if (nav === "OVERLAY") return { action: "open_overlay", dest }
          // SCROLL_TO / CHANGE_TO → ignorado
        }
      }
    }
  }
  // legado
  if (n.transitionNodeID) return { action: "navigate", dest: n.transitionNodeID }
  return null
}

function relCoords(node: FigNode, screen: FigNode) {
  const b = node.absoluteBoundingBox
  const s = screen.absoluteBoundingBox
  if (!b || !s || !s.width || !s.height) return null
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const x = clamp((b.x - s.x) / s.width)
  const y = clamp((b.y - s.y) / s.height)
  const w = clamp(b.width / s.width)
  const h = clamp(b.height / s.height)
  if (w < 0.005 || h < 0.005) return null
  return { x, y, w, h }
}

function overflowToScroll(dir?: string): ImportScreen["scroll"] {
  switch (dir) {
    case "HORIZONTAL_SCROLLING":
      return "horizontal"
    case "VERTICAL_SCROLLING":
      return "vertical"
    case "HORIZONTAL_AND_VERTICAL_SCROLLING":
      return "both"
    default:
      return "none"
  }
}

// Posição do overlay. Na prática o `overlayPositionType` NÃO vem na resposta
// REST do Figma (confirmado), então a detecção é por: (1) preset quando existe,
// (2) nome contendo "bottom sheet", (3) geometria — overlay full-width e mais
// baixo que a tela é bottom sheet.
function overlayPositionOf(
  dest: FigNode | undefined,
  screen: FigNode
): "bottom" | "center" {
  const t = dest?.overlayPositionType ?? ""
  if (t.includes("BOTTOM")) return "bottom"
  if (t.includes("TOP") || t === "CENTER") return "center"

  if (/bottom[\s_-]*sheet/i.test(dest?.name ?? "")) return "bottom"

  const b = dest?.absoluteBoundingBox
  const s = screen.absoluteBoundingBox
  if (b && s && s.width && s.height) {
    const fullWidth = b.width >= s.width * 0.9 // ocupa (quase) toda a largura
    const shorterThanScreen = b.height < s.height * 0.9 // não cobre a tela toda
    if (fullWidth && shorterThanScreen) return "bottom"
  }
  return "center"
}

// percorre a subárvore de uma tela coletando hotspots + regiões
function extractScreen(screen: FigNode, idx: Index): Omit<ImportScreen, "isStart" | "thumbUrl"> {
  const hotspots: ImportHotspot[] = []
  const regions: ImportRegion[] = []

  function walk(n: FigNode, depthFixed: boolean) {
    if (n !== screen) {
      // hotspot?
      const edge = edgeForNode(n)
      if (edge) {
        const coords = relCoords(n, screen)
        if (coords) {
          const dest = edge.dest ? idx.byId[edge.dest] : undefined
          hotspots.push({
            coords,
            action: edge.action,
            overlayPosition:
              edge.action === "open_overlay" ? overlayPositionOf(dest, screen) : null,
            destFigmaId: edge.dest,
          })
        }
      }
      // região fixa (barra) — só a mais externa fixa, e larga o suficiente
      if (!depthFixed && n.scrollBehavior === "FIXED") {
        const coords = relCoords(n, screen)
        if (coords && coords.w >= 0.5) regions.push({ kind: "fixed", coords, axis: "both" })
      }
      // scroll interno (sub-frame rolável, menor que a tela)
      if (n.type === "FRAME" && n.overflowDirection && n.overflowDirection !== "NONE") {
        const coords = relCoords(n, screen)
        if (coords && (coords.w < 0.98 || coords.h < 0.98)) {
          const sc = overflowToScroll(n.overflowDirection)
          regions.push({
            kind: "scroll",
            coords,
            axis: sc === "none" ? "vertical" : sc,
          })
        }
      }
    }
    const nowFixed = depthFixed || n.scrollBehavior === "FIXED"
    for (const c of n.children || []) walk(c, nowFixed)
  }
  walk(screen, false)

  const b = screen.absoluteBoundingBox
  return {
    figmaId: screen.id,
    name: screen.name,
    width: Math.round(b?.width ?? 0),
    height: Math.round(b?.height ?? 0),
    scroll: overflowToScroll(screen.overflowDirection),
    hotspots,
    regions,
  }
}

// coleta todos os edges presentes no índice (source → dest), por tela
function collectEdges(idx: Index): { sources: Set<string>; dests: Set<string> } {
  const sources = new Set<string>()
  const dests = new Set<string>()
  for (const n of Object.values(idx.byId)) {
    const edge = edgeForNode(n)
    if (!edge) continue
    sources.add(screenIdOf(n.id, idx))
    if (edge.dest) dests.add(edge.dest)
  }
  return { sources, dests }
}

// ---------------------------------------------------------------------------
// Orquestrador: monta o plano de importação a partir de um nó de entrada
// ---------------------------------------------------------------------------
const MAX_SCREENS = 250

export async function collectImportPlan(
  token: string,
  fileKey: string,
  entryNodeId: string | null
): Promise<ImportScreen[]> {
  const idx: Index = { byId: {}, parentOf: {} }

  // 1) nó de entrada (página/section/frame). Sem nodeId → primeira CANVAS do arquivo.
  let entryRootIds: string[]
  if (entryNodeId) {
    const nodes = await figmaGetNodes(token, fileKey, [entryNodeId])
    for (const root of Object.values(nodes)) indexTree(root, idx)
    entryRootIds = Object.keys(nodes)
  } else {
    const file = await figmaApi<{ document: FigNode }>(token, `/v1/files/${fileKey}?depth=4`)
    const canvas = (file.document.children || []).find((c) => c.type === "CANVAS")
    if (!canvas) throw new Error("Arquivo sem páginas.")
    indexTree(canvas, idx)
    entryRootIds = [canvas.id]
  }

  // 2) sementes: telas que participam do protótipo dentro do escopo de entrada
  const { sources, dests } = collectEdges(idx)
  const seeds = new Set<string>()
  for (const s of sources) seeds.add(s)
  for (const d of dests) if (idx.byId[d]) seeds.add(screenIdOf(d, idx))
  // se o nó de entrada é um frame isolado, ele é semente
  for (const rid of entryRootIds) {
    const node = idx.byId[rid]
    if (node && (node.type === "FRAME" || node.type === "COMPONENT")) seeds.add(rid)
  }

  // 3) Escopo ESTRITO ao link enviado: importamos apenas as telas dentro do
  //    nó/página compartilhado. NÃO seguimos destinos para outras páginas —
  //    isso evita "puxar o documento inteiro". Hotspots que apontem para fora
  //    do escopo são descartados na etapa de extração (não viram navegação).
  const screenIds = new Set<string>([...seeds].slice(0, MAX_SCREENS))

  // 4) extrai cada tela
  const startCandidates = new Set([...sources].filter((s) => !dests.has(s)))
  const screens: ImportScreen[] = []
  for (const id of screenIds) {
    const node = idx.byId[id]
    if (!node || (node.type !== "FRAME" && node.type !== "COMPONENT")) continue
    const base = extractScreen(node, idx)
    // descarta hotspots navigate/overlay cujo destino ficou fora do conjunto final
    base.hotspots = base.hotspots.filter((h) => {
      if (h.action === "back" || h.action === "close_overlay") return true
      return !!h.destFigmaId && screenIds.has(h.destFigmaId)
    })
    screens.push({ ...base, isStart: startCandidates.size === 1 && startCandidates.has(id) })
  }

  return screens
}
