"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { M3TextField } from "@/components/ui/m3-text-field"
import { SubmitButton } from "@/components/submit-button"
import {
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Loader2,
  X,
} from "lucide-react"
import {
  renameProjectAction,
  archiveProjectAction,
  deleteProjectAction,
} from "@/app/(dashboard)/projects/actions"

export function ProjectCardMenu({
  projectId,
  name,
  archived,
  studyCount,
}: {
  projectId: string
  name: string
  archived: boolean
  studyCount: number
}) {
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, startTransition] = useTransition()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high cursor-pointer outline-none"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Opções do projeto</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTimeout(() => setRenameOpen(true), 0)}>
            <Pencil className="h-4 w-4" />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              startTransition(async () => {
                await archiveProjectAction(projectId, !archived)
              })
            }
          >
            {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {archived ? "Desarquivar" : "Arquivar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setTimeout(() => setDeleteOpen(true), 0)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Renomear */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md rounded-[28px] p-0 gap-0 ring-0 border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        >
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <DialogTitle className="text-[22px] leading-7 font-semibold text-on-surface">
                Renomear projeto
              </DialogTitle>
              <DialogClose render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" />}>
                <X />
                <span className="sr-only">Fechar</span>
              </DialogClose>
            </div>
            <form
              action={async (fd) => {
                await renameProjectAction(projectId, fd)
                setRenameOpen(false)
              }}
              className="space-y-6"
            >
              <M3TextField label="Nome do projeto" name="name" defaultValue={name} labelBg="bg-popover" required autoFocus />
              <SubmitButton className="w-full">Salvar</SubmitButton>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso exclui <strong>{name}</strong> e {studyCount} estudo(s) dentro dele, com todos os
              dados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  await deleteProjectAction(projectId)
                  setDeleteOpen(false)
                  router.refresh()
                })
              }
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
