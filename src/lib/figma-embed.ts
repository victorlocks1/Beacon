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
  // "contain" (padrão) encaixa o frame inteiro; páginas longas usam encaixe na
  // largura ("fit-width"/"scale-down-width") para rolar na vertical.
  scaling?: "contain" | "fit-width" | "scale-down-width"
}): string | null {
  if (!FIGMA_EMBED_CLIENT_ID || !opts.fileKey) return null
  const u = new URL(`https://embed.figma.com/proto/${opts.fileKey}/beacon`)
  // node-id na URL usa "-"; o Figma guarda como "0:19236"
  if (opts.startNodeId) u.searchParams.set("node-id", opts.startNodeId.replace(/:/g, "-"))
  u.searchParams.set("embed-host", opts.host)
  u.searchParams.set("client-id", FIGMA_EMBED_CLIENT_ID)
  // "contain" = encaixa na tela ampliando/reduzindo (preenche o iframe, estilo
  // Maze). "scale-down" só reduzia → protótipo pequeno com fundo sobrando.
  u.searchParams.set("scaling", opts.scaling ?? "contain")
  u.searchParams.set("content-scaling", "fixed")
  if (opts.hideUi !== false) u.searchParams.set("hide-ui", "1")
  // Sem a moldura de aparelho que o Figma desenha conforme o "Device" do
  // protótipo: com ela, a tela real (o frame do DS) aparecia encolhida dentro de
  // um celular preto. O quadro do Beacon já tem o formato do dispositivo.
  u.searchParams.set("device-frame", "false")
  // sem rodapé do Figma e sem zoom/arrastar o canvas: o participante interage
  // só com o protótipo
  u.searchParams.set("footer", "false")
  u.searchParams.set("viewport-controls", "false")
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

// ── Margem do visualizador do Figma ──
// No navegador de computador, o visualizador do Figma deixa uma margem FIXA de
// ~48px em volta do protótipo (medido: igual em quadros de 200, 330 e 460px de
// largura). Num quadro de celular isso encolhia a tela do DS para ~70% e deixava
// uma borda preta. Compensamos aumentando o iframe 48px para cada lado — o quadro
// do Beacon (overflow hidden) corta exatamente a margem. Em aparelhos móveis o
// Figma não põe essa margem, então ali o iframe fica do tamanho do quadro.
export const FIGMA_VIEWER_PADDING_PX = 48

export function figmaEmbedFrameStyle(): React.CSSProperties {
  const mobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const pad = mobile ? 0 : FIGMA_VIEWER_PADDING_PX
  return {
    position: "absolute",
    left: -pad,
    top: -pad,
    width: `calc(100% + ${pad * 2}px)`,
    height: `calc(100% + ${pad * 2}px)`,
    border: "none",
    display: "block",
  }
}

// ── Controle do protótipo embutido (Embed API: mensagens para o iframe) ──
const FIGMA_ORIGIN = "https://www.figma.com"

/** Ação de um hotspot desenhado no Beacon sobre uma tela do Figma. */
export interface EmbedHotspotAction {
  action: "navigate" | "open_overlay" | "close_overlay" | "back"
  targetNodeId: string | null // node-id do Figma da tela de destino
}

/**
 * Executa no embed a ação de um hotspot do Beacon: ir para a tela de destino ou
 * voltar. O embed não sabe abrir overlays por comando, então "abrir overlay"
 * navega para a tela e "fechar overlay" volta. Hotspot sem destino não faz nada
 * (é só uma área clicável válida).
 */
export function runEmbedHotspotAction(
  iframe: HTMLIFrameElement | null,
  h: EmbedHotspotAction
): boolean {
  const win = iframe?.contentWindow
  if (!win) return false
  if (h.action === "back" || h.action === "close_overlay") {
    win.postMessage({ type: "NAVIGATE_BACKWARD" }, FIGMA_ORIGIN)
    return true
  }
  if (h.targetNodeId) {
    win.postMessage(
      { type: "NAVIGATE_TO_FRAME_AND_CLOSE_OVERLAYS", data: { nodeId: h.targetNodeId } },
      FIGMA_ORIGIN
    )
    return true
  }
  return false // hotspot sem destino: nada a navegar
}

/**
 * Com mouse (ponteiro fino) o clique pode agir já no PRESSIONAR: não há gesto de
 * arrastar para rolar. Em toque, é preciso esperar o soltar para distinguir um
 * toque de uma rolagem.
 */
export function actsOnPress(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches
}
