"use client"
import { useState } from "react"
import { updateStudyTitleAction } from "@/app/(dashboard)/studies/[id]/actions"
import { toast } from "@/components/ui/toast"
import { Pencil } from "lucide-react"

// Deixa o NEXT_REDIRECT (ex.: bloqueio de estudo ao vivo) propagar sem virar toast de erro.
function isRedirect(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}

export function EditableStudyTitle({
  studyId,
  initialTitle,
}: {
  studyId: string
  initialTitle: string
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialTitle)
  const [saved, setSaved] = useState(initialTitle)

  async function save() {
    const trimmed = name.trim() || saved
    setName(trimmed)
    setSaved(trimmed)
    setEditing(false)
    const fd = new FormData()
    fd.set("title", trimmed)
    try {
      await updateStudyTitleAction(studyId, fd)
      toast.success("Título atualizado")
    } catch (e) {
      if (isRedirect(e)) throw e
      toast.error("Não foi possível renomear.")
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") {
            setName(saved)
            setEditing(false)
          }
        }}
        className="text-headline-small text-on-surface bg-transparent border-b-2 border-primary outline-none max-w-[420px]"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 text-left"
      title="Renomear study"
    >
      <span className="text-headline-small text-on-surface">{saved}</span>
      <Pencil className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}
