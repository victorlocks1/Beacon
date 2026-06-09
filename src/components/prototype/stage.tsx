"use client"
import { useState } from "react"
import {
  deviceMaxWidth,
  deviceViewportHeight,
  type DeviceType,
  type ScrollMode,
} from "@/lib/device"
import { X } from "lucide-react"

export type HotspotAction = "navigate" | "open_overlay" | "close_overlay" | "back"
export type OverlayPosition = "bottom" | "center"

export interface StageHotspot {
  id: string
  coords: { x: number; y: number; w: number; h: number }
  action: HotspotAction
  overlayPosition: OverlayPosition | null
  targetScreenId: string | null
}
export interface StageScreen {
  id: string
  name: string
  imageUrl: string
  scroll: ScrollMode
  hotspots: StageHotspot[]
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
  screenId: string
  position: OverlayPosition
}

function frameStyles(scroll: ScrollMode, device: DeviceType) {
  const w = deviceMaxWidth[device]
  const h = deviceViewportHeight[device]
  switch (scroll) {
    case "vertical":
      return {
        frame: { width: w, maxWidth: "100%", height: h, overflowY: "auto", overflowX: "hidden" } as React.CSSProperties,
        img: { width: "100%", height: "auto", display: "block" } as React.CSSProperties,
      }
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
    default:
      return {
        frame: { width: w, maxWidth: "100%" } as React.CSSProperties,
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
        topScreenId: overlays.length ? overlays[overlays.length - 1].screenId : baseId,
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
      setOverlays((o) => [...o, { screenId: h.targetScreenId!, position: pos }])
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

  function revealedAfterOverlayPop(): string {
    return overlays.length > 1 ? overlays[overlays.length - 2].screenId : baseId
  }

  function closeTopOverlay(fromScreenId: string, hotspotId: string | null, xNorm: number, yNorm: number) {
    if (overlays.length === 0) return
    const revealed = revealedAfterOverlayPop()
    setOverlays((o) => o.slice(0, -1))
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
    if (overlays.length > 0) {
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
      <div className="relative bg-white shadow-lg rounded-lg overflow-hidden mx-auto" style={baseFrame.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={baseScreen.imageUrl}
          alt=""
          style={baseFrame.img}
          className="select-none cursor-pointer"
          draggable={false}
          onClick={(e) => handleImageClick(baseScreen, e)}
        />
      </div>

      {/* Overlays empilhados */}
      {overlays.map((layer, i) => {
        const screen = byId.get(layer.screenId)
        if (!screen) return null
        const isTop = i === overlays.length - 1
        return (
          <div key={i} className="absolute inset-0 z-10 flex" style={{
            alignItems: layer.position === "bottom" ? "flex-end" : "center",
            justifyContent: "center",
          }}>
            {/* Backdrop (clicar fecha o overlay do topo) */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => isTop && closeTopOverlay(layer.screenId, null, 0, 0)}
            />
            {/* Conteúdo do overlay */}
            <div
              className={
                "relative z-10 bg-white overflow-hidden shadow-2xl " +
                (layer.position === "bottom"
                  ? "w-full rounded-t-2xl"
                  : "w-[90%] rounded-2xl")
              }
            >
              {/* Botão fechar padrão (sempre disponível) */}
              <button
                onClick={() => closeTopOverlay(layer.screenId, null, 0, 0)}
                className="absolute top-2 right-2 z-20 rounded-full bg-black/50 text-white p-1 hover:bg-black/70"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screen.imageUrl}
                alt=""
                style={{ width: "100%", height: "auto", display: "block" }}
                className="select-none cursor-pointer"
                draggable={false}
                onClick={(e) => handleImageClick(screen, e)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
