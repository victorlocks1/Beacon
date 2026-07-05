"use client"
import { useEffect, useRef, useState } from "react"

// Spike: valida se dá pra usar o protótipo VIVO do Figma embutido + capturar
// eventos (navegação/clique/posição) pela Embed API. Página isolada, sem auth.
export default function FigmaEmbedTest() {
  const [url, setUrl] = useState("")
  const [embed, setEmbed] = useState("")
  const [events, setEvents] = useState<{ t: string; type: string; body: string }[]>([])
  const counter = useRef(0)

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.origin.includes("figma.com")) return
      const data = e.data
      if (!data || typeof data !== "object") return
      const type = (data.type as string) || "(sem type)"
      const clock = new Date().toLocaleTimeString()
      let body = ""
      try {
        body = JSON.stringify(data, null, 0)
      } catch {
        body = String(data)
      }
      counter.current += 1
      setEvents((prev) => [{ t: clock, type, body }, ...prev].slice(0, 300))
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [])

  function load() {
    const clean = url.trim()
    if (!clean) return
    setEvents([])
    counter.current = 0

    // Converte QUALQUER link do Figma (design/file/proto) para o modo PROTÓTIPO,
    // igual o Maze faz — senão o embed abre o arquivo inteiro (todas as telas).
    let target = clean
    try {
      const key = clean.match(/figma\.com\/(?:proto|design|file|board)\/([A-Za-z0-9_-]+)/)?.[1]
      const u = new URL(clean)
      const nodeId =
        u.searchParams.get("node-id") ||
        u.searchParams.get("starting-point-node-id") ||
        ""
      if (key) {
        const proto = new URL(`https://www.figma.com/proto/${key}/embed`)
        if (nodeId) proto.searchParams.set("node-id", nodeId)
        proto.searchParams.set("scaling", "scale-down")
        proto.searchParams.set("content-scaling", "fixed")
        proto.searchParams.set("hide-ui", "1") // UI limpa (só o protótipo), como no Maze
        target = proto.toString()
      }
    } catch {
      /* usa o link cru */
    }

    // embed_host habilita a Embed API (postMessage) do Figma
    setEmbed(`https://www.figma.com/embed?embed_host=beacon&url=${encodeURIComponent(target)}`)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0c", color: "#eee", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Spike — Figma embed + Embed API</h1>
        <p style={{ color: "#aaa", fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
          Cole o <b>link do protótipo</b> do Figma (o link de &ldquo;compartilhar&rdquo; do modo protótipo,
          normalmente <code>figma.com/proto/…</code>). Clique em Carregar, interaja no protótipo e
          observe os eventos que aparecem abaixo. Isso valida: (1) se carrega sem você editar,
          (2) se os eventos disparam <b>sem login</b> no Figma, (3) se o clique traz <b>posição</b>.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.figma.com/proto/…"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #333", background: "#161617", color: "#eee" }}
          />
          <button
            onClick={load}
            style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#4c8bf5", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Carregar
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 16, marginTop: 20, alignItems: "start" }}>
          <div style={{ border: "1px solid #222", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "9 / 16" }}>
            {embed ? (
              <iframe
                title="Figma"
                src={embed}
                allowFullScreen
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 14 }}>
                cole o link e clique em Carregar
              </div>
            )}
          </div>

          <div style={{ border: "1px solid #222", borderRadius: 12, background: "#0f0f10", padding: 12, height: 640, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <b style={{ fontSize: 13 }}>Eventos ({counter.current})</b>
              <button onClick={() => setEvents([])} style={{ fontSize: 12, background: "none", border: "1px solid #333", color: "#aaa", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                limpar
              </button>
            </div>
            {events.length === 0 ? (
              <p style={{ color: "#666", fontSize: 12 }}>nenhum evento ainda — interaja no protótipo</p>
            ) : (
              events.map((ev, i) => (
                <div key={i} style={{ borderTop: "1px solid #1c1c1e", padding: "6px 0" }}>
                  <div style={{ fontSize: 12, color: "#4c8bf5", fontWeight: 600 }}>
                    {ev.type} <span style={{ color: "#555", fontWeight: 400 }}>· {ev.t}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", wordBreak: "break-all", marginTop: 2 }}>{ev.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
