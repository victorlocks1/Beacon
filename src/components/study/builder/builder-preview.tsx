"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import { figmaEmbedUrl, FIGMA_EMBED_CLIENT_ID } from "@/lib/figma-embed"
import { MonitorSmartphone } from "lucide-react"

// Preview do protótipo no builder. Figma → embed vivo (com as dicas azuis, é
// autoria). Sem Figma → miniaturas das telas.
export function BuilderPreview({
  fileKey,
  startNodeId,
  screens,
}: {
  fileKey: string | null
  startNodeId: string | null
  screens: { id: string; name: string; imageUrl: string }[]
}) {
  const [src, setSrc] = useState<string | null>(null)
  const canEmbed = !!fileKey && !!FIGMA_EMBED_CLIENT_ID

  useEffect(() => {
    if (!canEmbed || !fileKey) return
    setSrc(figmaEmbedUrl({ fileKey, startNodeId, host: window.location.host }))
  }, [canEmbed, fileKey, startNodeId])

  if (canEmbed) {
    return (
      <div className="sticky top-4">
        <p className="text-label-medium text-on-surface-variant mb-2 flex items-center gap-1.5">
          <MonitorSmartphone className="h-4 w-4" /> Preview
        </p>
        <div className="mx-auto bg-white rounded-[24px] overflow-hidden border border-outline-variant shadow-sm aspect-[9/20] w-full max-w-[280px]">
          {src && (
            <iframe
              title="Preview"
              src={src}
              allowFullScreen
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            />
          )}
        </div>
      </div>
    )
  }

  // Fallback: miniaturas
  const withImg = screens.filter((s) => s.imageUrl)
  return (
    <div className="sticky top-4">
      <p className="text-label-medium text-on-surface-variant mb-2 flex items-center gap-1.5">
        <MonitorSmartphone className="h-4 w-4" /> Telas
      </p>
      {withImg.length === 0 ? (
        <p className="text-body-small text-on-surface-variant">Sem telas para pré-visualizar.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {withImg.slice(0, 8).map((s) => (
            <div
              key={s.id}
              className="relative aspect-[9/16] rounded-lg overflow-hidden border border-outline-variant bg-surface-container-high"
            >
              <Image src={s.imageUrl} alt={s.name} fill className="object-cover object-top" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
