export type DeviceType = "desktop" | "tablet" | "mobile"

/** Largura máxima (px) de exibição do protótipo por tipo de dispositivo. */
export const deviceMaxWidth: Record<DeviceType, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
}
