// Monta a URL do Embed Kit 2.0 (protótipo vivo do Figma) que EMITE eventos.
// O client-id é público (vai na URL) → vem de env NEXT_PUBLIC_. O app precisa
// estar publicado e com o domínio em "Allowed embed origins".

export const FIGMA_EMBED_CLIENT_ID = process.env.NEXT_PUBLIC_FIGMA_EMBED_CLIENT_ID ?? ""

export function figmaEmbedUrl(opts: {
  fileKey: string
  startNodeId?: string | null
  host: string
  hideUi?: boolean
  hotspotHints?: boolean // quadrados azuis do Figma (dicas de área clicável)
}): string | null {
  if (!FIGMA_EMBED_CLIENT_ID || !opts.fileKey) return null
  const u = new URL(`https://embed.figma.com/proto/${opts.fileKey}/beacon`)
  // node-id na URL usa "-"; o Figma guarda como "0:19236"
  if (opts.startNodeId) u.searchParams.set("node-id", opts.startNodeId.replace(/:/g, "-"))
  u.searchParams.set("embed-host", opts.host)
  u.searchParams.set("client-id", FIGMA_EMBED_CLIENT_ID)
  u.searchParams.set("scaling", "scale-down")
  u.searchParams.set("content-scaling", "fixed")
  if (opts.hideUi !== false) u.searchParams.set("hide-ui", "1")
  // No testador escondemos as dicas azuis (não entregar a área clicável). Na
  // revisão mantemos ligadas. Padrão do Figma é mostrar (1).
  if (opts.hotspotHints === false) u.searchParams.set("hotspot-hints", "0")
  return u.toString()
}

// Tipos de evento da Embed API que nos interessam.
export const FIGMA_EVENT_TYPES = [
  "INITIAL_LOAD",
  "PRESENTED_NODE_CHANGED",
  "MOUSE_PRESS_OR_RELEASE",
  "NEW_STATE",
] as const
