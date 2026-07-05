"use client"
import { useState, useRef } from "react"
import { updateScreenNameAction } from "@/app/(dashboard)/studies/[id]/actions"
import { toast } from "@/components/ui/toast"
import { Pencil } from "lucide-react"

interface Props {
  screenId: string
  studyId: string
  initialName: string
}

export function EditableScreenName({ screenId, studyId, initialName }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [saved, setSaved] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  async function save() {
    const trimmed = name.trim() || saved
    setName(trimmed)
    setSaved(trimmed)
    setEditing(false)
    try {
      await updateScreenNameAction(studyId, screenId, trimmed)
      toast.success("Tela renomeada")
    } catch (err) {
      console.error("Falha ao renomear tela:", err)
      toast.error("Não foi possível renomear.")
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
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
        className="text-sm font-medium bg-transparent border-b border-primary outline-none w-full max-w-[200px]"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1 text-sm font-medium text-left hover:text-primary transition-colors"
    >
      <span className="truncate max-w-[180px]">{saved}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
    </button>
  )
}
