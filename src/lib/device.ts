export type DeviceType = "desktop" | "tablet" | "mobile"

/** Largura máxima (px) de exibição do protótipo por tipo de dispositivo. */
export const deviceMaxWidth: Record<DeviceType, number> = {
  mobile: 360, // frame do Figma (360 × 800)
  tablet: 768,
  desktop: 1280,
}

/** Altura do viewport (px) usada quando a tela tem scroll, por dispositivo. */
export const deviceViewportHeight: Record<DeviceType, number> = {
  mobile: 800, // frame do Figma (360 × 800)
  tablet: 1024,
  desktop: 800,
}

export type ScrollMode = "none" | "vertical" | "horizontal" | "both"

// Proporção (largura/altura) do viewport de cada dispositivo e o quanto um frame
// pode ser mais alto que isso antes de ser tratado como PÁGINA LONGA (rola).
const viewportAspect: Record<DeviceType, number> = {
  // 360×800: a tela padrão de celular do DS (a mesma de deviceMaxWidth/
  // deviceViewportHeight) e o "Device" que o Figma usa nesses protótipos
  mobile: 360 / 800,
  tablet: 3 / 4,
  desktop: 16 / 10,
}
const LONG_PAGE_TOLERANCE = 1.25

export interface FrameLayout {
  /** largura/altura do quadro onde o protótipo é exibido */
  aspect: number
  /** página mais alta que o viewport: encaixa na largura e rola na vertical */
  longPage: boolean
  /** valor do parâmetro `scaling` do embed do Figma */
  scaling: "contain" | "fit-width" | "scale-down-width"
}

/**
 * Como exibir um frame do Figma no dispositivo ESCOLHIDO no estudo (o
 * dispositivo nunca é inferido do frame). Frame do tamanho de uma tela → quadro
 * com a proporção exata do frame. Frame mais alto que a tela (página web longa,
 * feed) → quadro com a proporção do VIEWPORT do dispositivo, encaixado na
 * largura e com rolagem vertical — em vez de encolher a página inteira.
 */
export function frameLayout(width: number, height: number, device: DeviceType): FrameLayout {
  const vp = viewportAspect[device]
  if (!(width > 0) || !(height > 0)) return { aspect: vp, longPage: false, scaling: "contain" }
  const longPage = height / width > LONG_PAGE_TOLERANCE / vp
  if (!longPage) return { aspect: width / height, longPage, scaling: "contain" }
  return {
    aspect: vp,
    longPage,
    // web: encaixa na largura sem ampliar além de 100% (pixel real) e rola.
    // mobile/tablet: "contain" mostra a tela do aparelho INTEIRA (a página longa
    // rola dentro dela). "fit-width" ampliava e cortava o rodapé (barra de abas).
    scaling: device === "desktop" ? "scale-down-width" : "contain",
  }
}
