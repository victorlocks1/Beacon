"use client"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Loader2 } from "lucide-react"
import { uploadScreensAction } from "@/app/(dashboard)/studies/[id]/actions"

export function ScreenUploadForm({ studyId }: { studyId: string }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    if (!files.length) return
    setUploading(true)

    const formData = new FormData()

    await Promise.all(
      Array.from(files).map(
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

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-2" />
        )}
        {uploading ? "Enviando..." : "Adicionar telas"}
      </Button>
    </div>
  )
}
