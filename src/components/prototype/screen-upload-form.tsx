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
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return
      }
      const files = extractImageFiles(e.clipboardData)
      if (files.length) {
        e.preventDefault()
        handleFiles(files)
      }
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
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
