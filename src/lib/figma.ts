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
export interface RegionPiece {
  figmaId: string
  // caixa da peça relativa à TELA, sem clamp (pode passar de 0..1)
  box: { x: number; y: number; w: number; h: number }
}
export interface ImportRegion {
  kind: "fixed" | "scroll"
  coords: { x: number; y: number; w: number; h: number }
  axis: "horizontal" | "vertical" | "both"
  // Peças do conteúdo rolável (container único ou cards soltos). Cada uma é
  // exportada e reposicionada na escala da base. Vazio p/ fixed.
  pieces?: RegionPiece[]
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
  // caixa que INCLUI efeitos (sombra/blur) — bate com a imagem exportada
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number } | null
  overflowDirection?: string
  scrollBehavior?: string
  overlayPositionType?: string
  clipsContent?: boolean
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Chama a REST API do Figma com retry/backoff em 429 (rate limit) e 5xx.
// Respeita o header Retry-After quando presente. Evita falhar o import por um
// limite temporário — importante porque reimportamos bastante.
async function figmaApi<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  })

  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    // Espera curta e CAPADA (inclui o Retry-After) — melhor falhar rápido com a
    // mensagem clara do que deixar o usuário no spinner por minutos.
    const retryAfter = Number(res.headers.get("retry-after"))
    const base = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt
    await sleep(Math.min(6000, base))
    return figmaApi(token, path, attempt + 1)
  }

  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.err || body?.message || ""
    } catch {
      /* ignore */
    }
    if (res.status === 429) {
      throw new Error(
        "Figma limitou as requisições (429). Aguarde 1-2 minutos e importe de novo."
      )
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

// Tipos de nó que podem ser uma "tela" (frame de topo do protótipo). Inclui
// INSTANCE porque bottom sheets/modais às vezes são instâncias de componente —
// sem isso, a sheet não é importada e a interação que a abre é descartada.
const SCREEN_TYPES = new Set(["FRAME", "COMPONENT", "INSTANCE"])

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

// Como relCoords, mas SEM clamp — a tira transborda o frame (w/h podem passar de
// 1 e x/y podem ser negativos). Usada para posicionar a tira na escala da base.
function relCoordsRaw(box: Box | null | undefined, screen: FigNode) {
  const s = screen.absoluteBoundingBox
  if (!box || !s || !s.width || !s.height) return null
  return {
    x: (box.x - s.x) / s.width,
    y: (box.y - s.y) / s.height,
    w: box.width / s.width,
    h: box.height / s.height,
  }
}

// Coleta todos os descendentes (com bounding box) até uma profundidade sã.
function collectDescendants(node: FigNode, out: FigNode[], depth = 0) {
  if (depth > 14) return
  for (const c of node.children || []) {
    out.push(c)
    collectDescendants(c, out, depth + 1)
  }
}

type Box = { x: number; y: number; width: number; height: number }

const OVER = 1.02 // conteúdo precisa passar ao menos 2% da borda para valer scroll

function boxOverflows(b: Box | null | undefined, fb: Box, wantH: boolean, wantV: boolean) {
  if (!b) return false
  if (wantH && b.x + b.width > fb.x + fb.width * OVER) return true
  if (wantV && b.y + b.height > fb.y + fb.height * OVER) return true
  return false
}

// Decisão de scroll = a CONFIG do Figma ("Overflow" do frame → overflowDirection).
// As PEÇAS do conteúdo (o que rola) são: o container único quando ele transborda
// (linha com hug), ou os filhos soltos (cards lado a lado). Cada peça é exportada
// e reposicionada na escala da base — cobre os dois formatos sem fantasma.
function detectScrollRegion(frame: FigNode): {
  axis: "horizontal" | "vertical" | "both"
  pieceIds: string[]
} | null {
  const fb = frame.absoluteBoundingBox as Box | null | undefined
  if (!SCREEN_TYPES.has(frame.type) || !fb || !fb.width || !fb.height) return null

  const sc = overflowToScroll(frame.overflowDirection)
  if (sc === "none") return null
  const wantH = sc === "horizontal" || sc === "both"
  const wantV = sc === "vertical" || sc === "both"

  // desce por wrappers de 1 único filho (frames que só embrulham o conteúdo)
  let container = frame
  let guard = 0
  while (container.children && container.children.length === 1 && guard++ < 20) {
    container = container.children[0]
  }

  const kids = (container.children ?? []).filter((k) => k.absoluteBoundingBox)
  // container único que transborda → 1 peça (linha hug). Senão → os filhos.
  const pieceNodes =
    container !== frame && boxOverflows(container.absoluteBoundingBox as Box, fb, wantH, wantV)
      ? [container]
      : kids
  if (!pieceNodes.length) return null

  // a UNIÃO das peças precisa transbordar o frame — senão não há o que rolar
  // (e criar região só duplicaria a base).
  const union = pieceNodes.reduce<Box | null>((acc, n) => {
    const b = n.absoluteBoundingBox as Box | null | undefined
    if (!b) return acc
    if (!acc) return { ...b }
    const x = Math.min(acc.x, b.x)
    const y = Math.min(acc.y, b.y)
    return {
      x,
      y,
      width: Math.max(acc.x + acc.width, b.x + b.width) - x,
      height: Math.max(acc.y + acc.height, b.y + b.height) - y,
    }
  }, null)
  if (!boxOverflows(union, fb, wantH, wantV)) return null

  return { axis: sc, pieceIds: pieceNodes.map((n) => n.id) }
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
    // Uma bottom sheet ocupa a largura toda (ancorada na base). Modais/diálogos
    // centralizados têm margens laterais (largura menor que a tela). Então:
    // largura cheia ⇒ bottom; caso contrário ⇒ center. Independe da ALTURA —
    // sheets altas (quase tela cheia) também sobem de baixo. Antes exigíamos
    // "mais baixa que a tela", o que jogava as sheets altas para "center".
    const fullWidth = b.width >= s.width * 0.9
    if (fullWidth) return "bottom"
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
        // Sem clamp: hotspots DENTRO de áreas roláveis podem começar além do
        // frame (x/y > 1) — o clamp os grudava na borda e quebrava o clique
        // depois de rolar. Guarda apenas contra tamanho ínfimo / nós distantes.
        const raw = relCoordsRaw(n.absoluteBoundingBox, screen)
        const coords =
          raw && raw.w >= 0.005 && raw.h >= 0.005 && raw.x < 4 && raw.x + raw.w > -0.5 && raw.y < 6 && raw.y + raw.h > -0.5
            ? raw
            : null
        if (coords) {
          // Normaliza o destino para o FRAME DE TOPO (a "tela" que importamos e
          // renderizamos). O destino cru de um overlay/navigate pode ser um nó
          // aninhado; sem normalizar, ele nunca casa com um screenId no import
          // e o hotspot é descartado (a interação "não funciona").
          const destScreenId = edge.dest ? screenIdOf(edge.dest, idx) : null
          const destNode = destScreenId ? idx.byId[destScreenId] : undefined
          hotspots.push({
            coords,
            action: edge.action,
            overlayPosition:
              edge.action === "open_overlay" ? overlayPositionOf(destNode, screen) : null,
            destFigmaId: destScreenId,
          })
        }
      }
      // região fixa (barra) — só a mais externa fixa, e larga o suficiente
      if (!depthFixed && n.scrollBehavior === "FIXED") {
        const coords = relCoords(n, screen)
        if (coords && coords.w >= 0.5) regions.push({ kind: "fixed", coords, axis: "both" })
      }
      // scroll interno (sub-frame rolável, menor que a tela)
      const det = detectScrollRegion(n)
      if (det) {
        const coords = relCoords(n, screen)
        if (coords) {
          const pieces = det.pieceIds
            .map((id) => {
              const node = idx.byId[id]
              // posiciona pela render bounds (inclui sombra) p/ bater com o PNG
              const box = relCoordsRaw(
                node?.absoluteRenderBounds ?? node?.absoluteBoundingBox,
                screen
              )
              return box ? { figmaId: id, box } : null
            })
            .filter((p): p is RegionPiece => p != null)
          if (pieces.length) {
            regions.push({ kind: "scroll", coords, axis: det.axis, pieces })
          }
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
    if (node && SCREEN_TYPES.has(node.type)) seeds.add(rid)
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
    if (!node || !SCREEN_TYPES.has(node.type)) continue
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
