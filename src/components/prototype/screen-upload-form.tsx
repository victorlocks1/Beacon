"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Upload, Loader2, ImagePlus } from "lucide-react"
import { uploadScreensAction } from "@/app/(dashboard)/studies/[id]/actions"
import { cn } from "@/lib/utils"

// Extrai imagens do clipboard tanto de arquivos copiados quanto de
// imagem-dado (ex.: print de tela), que vem em items, não em files.
function extractImageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return []
  const out: File[] = []
  for (const f of Array.from(dt.files)) {
    if (f.type.startsWith("image/")) out.push(f)
  }
  if (out.length === 0 && dt.items) {
    for (const it of Array.from(dt.items)) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile()
        if (f) out.push(f)
      }
    }
  }
  return out
}

export function ScreenUploadForm({ studyId }: { studyId: string }) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  // Marca quando um paste nativo já tratou a imagem, para o fallback de
  // clipboard (async API) não subir a mesma imagem duas vezes.
  const recentPasteRef = useRef(0)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"))
      if (!arr.length) return
      setUploading(true)

      const formData = new FormData()
      await Promise.all(
        arr.map(
          (file) =>
            new Promise<void>((resolve) => {
              const img = new Image()
              img.onload = () => {
                formData.append("files", file)
                formData.append("widths", String(img.naturalWidth))
                formData.append("heights", String(img.naturalHeight))
                formData.append(
                  "names",
                  file.name.replace(/\.[^/.]+$/, "") || "Tela colada"
                )
                URL.revokeObjectURL(img.src)
                resolve()
              }
              img.src = URL.createObjectURL(file)
            })
        )
      )

      await uploadScreensAction(studyId, formData)
      setUploading(false)
    },
    [studyId]
  )

  // Colar imagem com Ctrl/Cmd+V (em qualquer lugar da página, exceto campos de texto)
  useEffect(() => {
    function isEditable(t: EventTarget | null) {
      const el = t as HTMLElement | null
      return !!(
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
    }

    // 1) Caminho nativo: evento paste com clipboardData (Chrome/Firefox/Edge)
    function onPaste(e: ClipboardEvent) {
      if (isEditable(e.target)) return
      const files = extractImageFiles(e.clipboardData)
      if (files.length) {
        e.preventDefault()
        recentPasteRef.current = Date.now()
        handleFiles(files)
      }
    }

    // 2) Fallback: Async Clipboard API no atalho Cmd/Ctrl+V.
    // Necessário no Safari (que não dispara paste fora de campos editáveis)
    // e quando o foco não está num elemento que recebe o evento paste.
    async function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "v") return
      if (isEditable(e.target)) return
      if (!navigator.clipboard?.read) return
      // Dá prioridade ao evento paste nativo (dispara logo em seguida);
      // só usa o fallback se ele não tratou a imagem.
      await new Promise((r) => setTimeout(r, 150))
      if (Date.now() - recentPasteRef.current < 1500) return
      try {
        const items = await navigator.clipboard.read()
        const files: File[] = []
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith("image/"))
          if (imgType) {
            const blob = await item.getType(imgType)
            const ext = imgType.split("/")[1] ?? "png"
            files.push(new File([blob], `Tela colada.${ext}`, { type: blob.type }))
          }
        }
        if (files.length) {
          recentPasteRef.current = Date.now()
          handleFiles(files)
        }
      } catch {
        // permissão negada ou clipboard sem imagem — ignora silenciosamente
      }
    }

    document.addEventListener("paste", onPaste)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [handleFiles])

  // Foca a área de upload ao montar, para o Ctrl/Cmd+V funcionar de cara
  useEffect(() => {
    dropRef.current?.focus({ preventScroll: true })
  }, [])

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      ref={dropRef}
      tabIndex={0}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-6 text-center transition-colors cursor-pointer outline-none",
        dragging
          ? "border-primary bg-primary/5"
          : "border-outline-variant hover:border-on-surface-variant/60 hover:bg-surface-container-high/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        uploading && "pointer-events-none opacity-60"
      )}
      onClick={() => inputRef.current?.click()}
      onPaste={(e) => {
        const files = extractImageFiles(e.clipboardData)
        if (files.length) {
          e.preventDefault()
          recentPasteRef.current = Date.now()
          handleFiles(files)
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {uploading ? (
        <>
          <Loader2 className="h-6 w-6 text-on-surface-variant animate-spin" />
          <p className="text-body-medium text-on-surface-variant">Enviando...</p>
        </>
      ) : (
        <>
          <div className={cn("rounded-full p-2.5 transition-colors", dragging ? "bg-primary/10" : "bg-surface-container-high")}>
            {dragging ? (
              <ImagePlus className="h-5 w-5 text-primary" />
            ) : (
              <Upload className="h-5 w-5 text-on-surface-variant" />
            )}
          </div>
          <div>
            <p className="text-title-small text-on-surface">
              {dragging ? "Solte para adicionar" : "Arraste, clique ou cole (Ctrl/⌘+V)"}
            </p>
            <p className="text-body-small text-on-surface-variant mt-0.5">PNG ou JPG</p>
          </div>
        </>
      )}
    </div>
  )
}
