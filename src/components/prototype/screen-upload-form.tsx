"use client"
import { useRef, useState } from "react"
import { Upload, Loader2, ImagePlus } from "lucide-react"
import { uploadScreensAction } from "@/app/(dashboard)/studies/[id]/actions"
import { cn } from "@/lib/utils"

export function ScreenUploadForm({ studyId }: { studyId: string }) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg"].includes(f.type)
    )
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
              formData.append("names", file.name.replace(/\.[^/.]+$/, ""))
              URL.revokeObjectURL(img.src)
              resolve()
            }
            img.src = URL.createObjectURL(file)
          })
      )
    )

    await uploadScreensAction(studyId, formData)
    setUploading(false)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragging(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-5 text-center transition-colors cursor-pointer",
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
        uploading && "pointer-events-none opacity-60"
      )}
      onClick={() => inputRef.current?.click()}
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
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Enviando...</p>
        </>
      ) : (
        <>
          <div className={cn("rounded-full p-2 transition-colors", dragging ? "bg-primary/10" : "bg-muted")}>
            {dragging ? (
              <ImagePlus className="h-5 w-5 text-primary" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {dragging ? "Solte para adicionar" : "Arraste imagens ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">PNG ou JPG</p>
          </div>
        </>
      )}
    </div>
  )
}
