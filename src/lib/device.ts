export type DeviceType = "desktop" | "tablet" | "mobile"

/** Largura máxima (px) de exibição do protótipo por tipo de dispositivo. */
export const deviceMaxWidth: Record<DeviceType, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
}

/** Altura do viewport (px) usada quando a tela tem scroll, por dispositivo. */
export const deviceViewportHeight: Record<DeviceType, number> = {
  mobile: 760,
  tablet: 1024,
  desktop: 800,
}

export type ScrollMode = "none" | "vertical" | "horizontal" | "both"
