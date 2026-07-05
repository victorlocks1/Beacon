"use client"
import { useRef, useState } from "react"
import {
  deviceMaxWidth,
  deviceViewportHeight,
  type DeviceType,
  type ScrollMode,
} from "@/lib/device"

export type HotspotAction = "navigate" | "open_overlay" | "close_overlay" | "back"
export type OverlayPosition = "bottom" | "center"

export interface StageHotspot {
  id: string
  coords: { x: number; y: number; w: number; h: number }
  action: HotspotAction
  overlayPosition: OverlayPosition | null
  targetScreenId: string | null
}
export interface StageScrollRegion {
  id: string
  kind: "scroll" | "fixed"
  coords: { x: number; y: number; w: number; h: number }
  axis: "horizontal" | "vertical" | "both"
  imageUrl: string | null
}
export interface StageScreen {
  id: string
  name: string
  imageUrl: string
  width: number
  height: number
  scroll: ScrollMode
  hotspots: StageHotspot[]
  scrollRegions?: StageScrollRegion[]
}
export interface StageInteraction {
  kind: HotspotAction | "misclick"
  fromScreenId: string
  toScreenId: string | null
  topScreenId: string
  hotspotId: string | null
  xNorm: number
  yNorm: number
}

interface OverlayLayer {
  key: number
  screenId: string
  position: OverlayPosition
  closing?: boolean
}

const OVERLAY_EXIT_MS = 240

function frameStyles(scroll: ScrollMode, device: DeviceType) {
  const w = deviceMaxWidth[device]
  const h = deviceViewportHeight[device]
  switch (scroll) {
    case "horizontal":
      return {
        frame: { width: w, maxWidth: "100%", height: h, overflowX: "auto", overflowY: "hidden" } as React.CSSProperties,
        img: { height: h, width: "auto", maxWidth: "none", display: "block" } as React.CSSProperties,
      }
    case "both":
      return {
        frame: { width: w, maxWidth: "100%", height: h, overflow: "auto" } as React.CSSProperties,
        img: { width: "auto", height: "auto", maxWidth: "none", display: "block" } as React.CSSProperties,
      }
    // "none" e "vertical": ajusta à largura e rola na vertical automaticamente
    // quando a tela for mais alta que o viewport do dispositivo.
    default:
      return {
        frame: { width: w, maxWidth: "100%", maxHeight: h, overflowY: "auto", overflowX: "hidden" } as React.CSSProperties,
        img: { width: "100%", height: "auto", display: "block" } as React.CSSProperties,
      }
  }
}

export function PrototypeStage({
  screens,
  deviceType,
  initialScreenId,
  onInteraction,
}: {
  screens: StageScreen[]
  deviceType: DeviceType
  initialScreenId: string
  onInteraction?: (e: StageInteraction) => void
}) {
  const byId = new Map(screens.map((s) => [s.id, s]))
  const [baseHistory, setBaseHistory] = useState<string[]>([initialScreenId])
  const [overlays, setOverlays] = useState<OverlayLayer[]>([])
  const overlayKeyRef = useRef(0)

  // Overlays visíveis (ignora os que estão saindo com animação)
  const liveOverlays = overlays.filter((o) => !o.closing)

  const baseId = baseHistory[baseHistory.length - 1]
  const baseScreen = byId.get(baseId) ?? screens[0]

  function hitTest(screen: StageScreen, xNorm: number, yNorm: number) {
    return [...screen.hotspots]
      .reverse()
      .find(
        (h) =>
          xNorm >= h.coords.x &&
          xNorm <= h.coords.x + h.coords.w &&
          yNorm >= h.coords.y &&
          yNorm <= h.coords.y + h.coords.h
      )
  }

  function handleImageClick(screen: StageScreen, e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const xNorm = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const yNorm = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    const hit = hitTest(screen, xNorm, yNorm)

    if (!hit) {
      onInteraction?.({
        kind: "misclick",
        fromScreenId: screen.id,
        toScreenId: null,
        topScreenId: liveOverlays.length ? liveOverlays[liveOverlays.length - 1].screenId : baseId,
        hotspotId: null,
        xNorm,
        yNorm,
      })
      return
    }
    dispatch(hit, screen.id, xNorm, yNorm)
  }

  // Clique numa faixa fixa: mapeia a posição local da tira de volta para as
  // coordenadas normalizadas da tela base (a faixa é um recorte horizontal dela).
  function handleFixedClick(
    screen: StageScreen,
    region: StageScrollRegion,
    e: React.MouseEvent<HTMLDivElement>
  ) {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const sy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    const xNorm = region.coords.x + sx * region.coords.w
    const yNorm = region.coords.y + sy * region.coords.h
    const hit = hitTest(screen, xNorm, yNorm)
    if (!hit) {
      onInteraction?.({
        kind: "misclick",
        fromScreenId: screen.id,
        toScreenId: null,
        topScreenId: liveOverlays.length ? liveOverlays[liveOverlays.length - 1].screenId : baseId,
        hotspotId: null,
        xNorm,
        yNorm,
      })
      return
    }
    dispatch(hit, screen.id, xNorm, yNorm)
  }

  function dispatch(h: StageHotspot, fromScreenId: string, xNorm: number, yNorm: number) {
    if (h.action === "navigate") {
      if (!h.targetScreenId) return
      setBaseHistory((hist) => [...hist, h.targetScreenId!])
      setOverlays([])
      onInteraction?.({
        kind: "navigate",
        fromScreenId,
        toScreenId: h.targetScreenId,
        topScreenId: h.targetScreenId,
        hotspotId: h.id,
        xNorm,
        yNorm,
      })
    } else if (h.action === "open_overlay") {
      if (!h.targetScreenId) return
      const pos = h.overlayPosition ?? "bottom"
      const key = ++overlayKeyRef.current
      setOverlays((o) => [...o, { key, screenId: h.targetScreenId!, position: pos }])
      onInteraction?.({
        kind: "open_overlay",
        fromScreenId,
        toScreenId: h.targetScreenId,
        topScreenId: h.targetScreenId,
        hotspotId: h.id,
        xNorm,
        yNorm,
      })
    } else if (h.action === "close_overlay") {
      closeTopOverlay(fromScreenId, h.id, xNorm, yNorm)
    } else if (h.action === "back") {
      goBack(fromScreenId, h.id, xNorm, yNorm)
    }
  }

  function closeTopOverlay(fromScreenId: string, hotspotId: string | null, xNorm: number, yNorm: number) {
    const live = overlays.filter((o) => !o.closing)
    if (live.length === 0) return
    const top = live[live.length - 1]
    const revealed = live.length > 1 ? live[live.length - 2].screenId : baseId

    // marca como "saindo" para tocar a animação, depois remove de fato
    setOverlays((o) => o.map((l) => (l.key === top.key ? { ...l, closing: true } : l)))
    setTimeout(() => {
      setOverlays((o) => o.filter((l) => l.key !== top.key))
    }, OVERLAY_EXIT_MS)

    onInteraction?.({
      kind: "close_overlay",
      fromScreenId,
      toScreenId: revealed,
      topScreenId: revealed,
      hotspotId,
      xNorm,
      yNorm,
    })
  }

  function goBack(fromScreenId: string, hotspotId: string, xNorm: number, yNorm: number) {
    if (liveOverlays.length > 0) {
      closeTopOverlay(fromScreenId, hotspotId, xNorm, yNorm)
      return
    }
    if (baseHistory.length > 1) {
      const revealed = baseHistory[baseHistory.length - 2]
      setBaseHistory((hist) => hist.slice(0, -1))
      onInteraction?.({
        kind: "back",
        fromScreenId,
        toScreenId: revealed,
        topScreenId: revealed,
        hotspotId,
        xNorm,
        yNorm,
      })
    }
  }

  const baseFrame = frameStyles(baseScreen.scroll, deviceType)

  return (
    <div className="relative mx-auto" style={{ width: deviceMaxWidth[deviceType], maxWidth: "100%" }}>
      {/* Tela base */}
      <div
        className="relative bg-white shadow-lg rounded-lg mx-auto subtle-scroll"
        style={baseFrame.frame}
      >
        <div className="relative" style={{ width: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={baseScreen.imageUrl}
            alt=""
            style={baseFrame.img}
            className="select-none cursor-pointer"
            draggable={false}
            onClick={(e) => handleImageClick(baseScreen, e)}
          />
          <RegionLayer regions={baseScreen.scrollRegions} />
        </div>
      </div>

      {/* Faixas fixas (barras de topo/rodapé que não rolam com a tela) */}
      {baseScreen.scrollRegions
        ?.filter((r) => r.kind === "fixed")
        .map((r) => {
          const pinTop = r.coords.y + r.coords.h / 2 < 0.5
          // recorte vertical da própria imagem da tela, exibido à largura total
          const denom = 1 - r.coords.h
          const posY = denom > 0 ? (r.coords.y / denom) * 100 : 0
          return (
            <div
              key={r.id}
              className="absolute left-0 right-0 z-[5] cursor-pointer select-none"
              style={{
                [pinTop ? "top" : "bottom"]: 0,
                aspectRatio: `${baseScreen.width} / ${r.coords.h * baseScreen.height}`,
                backgroundImage: `url(${baseScreen.imageUrl})`,
                backgroundSize: "100% auto",
                backgroundRepeat: "no-repeat",
                backgroundPosition: `0% ${posY}%`,
              }}
              onClick={(e) => handleFixedClick(baseScreen, r, e)}
            />
          )
        })}

      {/* Overlays empilhados */}
      {overlays.map((layer) => {
        const screen = byId.get(layer.screenId)
        if (!screen) return null
        const lastLive = liveOverlays[liveOverlays.length - 1]
        const isTop = !layer.closing && lastLive?.key === layer.key
        const backdropAnim = layer.closing
          ? "animate-out fade-out duration-200"
          : "animate-in fade-in duration-200"
        const contentAnim =
          layer.position === "bottom"
            ? layer.closing
              ? "animate-out slide-out-to-bottom duration-200 ease-in"
              : "animate-in slide-in-from-bottom duration-300 ease-out"
            : layer.closing
              ? "animate-out fade-out zoom-out-95 duration-150 ease-in"
              : "animate-in fade-in zoom-in-95 duration-200 ease-out"
        return (
          <div
            key={layer.key}
            className="absolute inset-0 z-10 flex"
            style={{
              alignItems: layer.position === "bottom" ? "flex-end" : "center",
              justifyContent: "center",
              pointerEvents: layer.closing ? "none" : "auto",
            }}
          >
            {/* Backdrop (clicar fecha o overlay do topo) */}
            <div
              className={`absolute inset-0 bg-black/40 ${backdropAnim}`}
              onClick={() => isTop && closeTopOverlay(layer.screenId, null, 0, 0)}
            />
            {/* Conteúdo do overlay. Sem fundo branco: a bottom sheet do Figma
                costuma vir com o topo transparente (a sheet ancorada embaixo);
                pintar de branco viraria uma "caixa branca". A transparência do
                PNG revela a base escurecida, igual ao protótipo. */}
            <div
              className={
                "relative z-10 overflow-hidden " +
                (layer.position === "bottom" ? "w-full " : "w-[90%] rounded-2xl shadow-2xl ") +
                contentAnim
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screen.imageUrl}
                alt=""
                // aspect-ratio reserva a altura ANTES da imagem carregar: sem
                // isso a altura vai de 0→cheia e a animação de subida "quica".
                style={{
                  width: "100%",
                  height: "auto",
                  aspectRatio: `${screen.width} / ${screen.height}`,
                  display: "block",
                }}
                className="select-none cursor-pointer"
                draggable={false}
                onClick={(e) => handleImageClick(screen, e)}
              />
              <RegionLayer regions={screen.scrollRegions} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RegionLayer({ regions }: { regions?: StageScrollRegion[] }) {
  const scrollRegions = regions?.filter((r) => r.kind === "scroll" && r.imageUrl)
  if (!scrollRegions?.length) return null
  return (
    <>
      {scrollRegions.map((r) => {
        const horiz = r.axis === "horizontal" || r.axis === "both"
        const vert = r.axis === "vertical" || r.axis === "both"
        const imgStyle: React.CSSProperties =
          r.axis === "horizontal"
            ? { height: "100%", width: "auto", maxWidth: "none", display: "block" }
            : r.axis === "vertical"
              ? { width: "100%", height: "auto", display: "block" }
              : { width: "auto", height: "auto", maxWidth: "none", display: "block" }
        return (
          <div
            key={r.id}
            className="absolute invisible-scroll bg-white"
            style={{
              left: `${r.coords.x * 100}%`,
              top: `${r.coords.y * 100}%`,
              width: `${r.coords.w * 100}%`,
              height: `${r.coords.h * 100}%`,
              overflowX: horiz ? "auto" : "hidden",
              overflowY: vert ? "auto" : "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl ?? ""} alt="" draggable={false} className="select-none" style={imgStyle} />
          </div>
        )
      })}
    </>
  )
}
