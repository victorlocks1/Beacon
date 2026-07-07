"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { figmaEmbedUrl, FIGMA_EVENT_TYPES } from "@/lib/figma-embed"
import { deviceMaxWidth, deviceViewportHeight, type DeviceType } from "@/lib/device"

interface BufferedEvent {
  type: string
  data: unknown
  clientTsMs: number
}

const VALID = new Set<string>(FIGMA_EVENT_TYPES)

// Runner do protótipo VIVO do Figma (embed) + captura dos eventos da Embed API.
// Fase 1: só embute, captura e posta os eventos crus. As métricas vêm depois.
export function FigmaEmbedRunner({
  token,
  fileKey,
  startNodeId,
  deviceType = "mobile",
}: {
  token: string
  fileKey: string
  startNodeId: string | null
  deviceType?: DeviceType
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const bufferRef = useRef<BufferedEvent[]>([])
  const startRef = useRef(0)

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now())

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return
    const events = bufferRef.current
    bufferRef.current = []
    try {
      await fetch("/api/t/figma-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, events }),
        keepalive: true,
      })
    } catch {
      bufferRef.current = [...events, ...bufferRef.current]
    }
  }, [token])

  // Monta a URL de embed no cliente (usa o host real p/ bater com o Allowed origin).
  // Fase 1: NÃO forçamos node-id — deixamos o Figma abrir no ponto de início do
  // protótipo (evita o "snippet not found" quando o frame inicial detectado erra).
  useEffect(() => {
    void startNodeId
    setSrc(
      figmaEmbedUrl({
        fileKey,
        startNodeId: null,
        host: window.location.host,
      })
    )
    startRef.current = now()
  }, [fileKey, startNodeId])

  // Captura os eventos da Embed API (vêm de https://www.figma.com)
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.origin.includes("figma.com")) return
      const d = e.data
      if (!d || typeof d !== "object" || !VALID.has(d.type)) return
      bufferRef.current.push({
        type: d.type,
        data: d.data ?? {},
        clientTsMs: Math.round(now() - startRef.current),
      })
      setCount((c) => c + 1)
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [])

  // Flush periódico + ao sair da página
  useEffect(() => {
    const id = setInterval(flush, 3000)
    function onHide() {
      if (bufferRef.current.length === 0) return
      navigator.sendBeacon(
        "/api/t/figma-events",
        new Blob([JSON.stringify({ token, events: bufferRef.current })], { type: "application/json" })
      )
      bufferRef.current = []
    }
    window.addEventListener("pagehide", onHide)
    return () => {
      clearInterval(id)
      window.removeEventListener("pagehide", onHide)
      flush()
    }
  }, [flush, token])

  const w = deviceMaxWidth[deviceType]
  const h = deviceViewportHeight[deviceType]

  if (!src) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4 text-center">
        <p className="text-body-medium text-on-surface-variant">
          Protótipo do Figma indisponível para o modo ao vivo (falta configuração do embed).
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container flex flex-col items-center justify-center gap-3 p-4">
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-lg"
        style={{ width: w, height: h, maxWidth: "100%" }}
      >
        <iframe
          title="Protótipo"
          src={src}
          allowFullScreen
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        />
      </div>
      {/* Fase 1: indicador de captura (removido nas próximas fases) */}
      <p className="text-label-small text-on-surface-variant/70">eventos capturados: {count}</p>
    </div>
  )
}
