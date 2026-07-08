"use client"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Sparkles,
  Flag,
  ClipboardCheck,
  HelpCircle,
  Plus,
  GripVertical,
  Trash2,
  CheckCircle2,
} from "lucide-react"
import { MissionForm, type MissionInitial, type Screen as MissionFormScreen } from "@/components/mission/mission-form"
import { WelcomeEditor } from "@/components/study/builder/welcome-editor"
import { QuestionEditor, type QuestionInitial } from "@/components/study/builder/question-editor"
import { SusEditor } from "@/components/study/builder/sus-editor"
import {
  reorderBlocksAction,
  deleteMissionAction,
  deleteQuestionAction,
  deleteSusBlockAction,
  addSusBlockAction,
} from "@/app/(dashboard)/studies/[id]/actions"

function isRedirect(e: unknown) {
  const d = (e as { digest?: unknown })?.digest
  return typeof d === "string" && d.startsWith("NEXT_REDIRECT")
}

export type BuilderBlock =
  | { id: string; kind: "mission"; missionId: string; task: string; startScreenId: string; initial: MissionInitial }
  | { id: string; kind: "question"; questionId: string; title: string; qtype: string; initial: QuestionInitial }
  | { id: string; kind: "sus" }

const qLabel: Record<string, string> = {
  open: "Aberta",
  choice: "Múltipla escolha",
  rating: "Estrelas",
  binary: "Sim / Não",
}

type Selection = "welcome" | "thanks" | "new-mission" | "new-question" | string

export function StudyBuilder({
  studyId,
  editable,
  deviceType,
  welcome,
  blocks,
  missionScreens,
  figmaFileKey,
  sus,
}: {
  studyId: string
  editable: boolean
  deviceType: "desktop" | "tablet" | "mobile"
  welcome: { title: string | null; message: string | null; howItWorks: string | null; defaultTitle: string }
  blocks: BuilderBlock[]
  missionScreens: MissionFormScreen[]
  figmaFileKey: string | null
  sus: { statements: string[]; scaleOptions: string[]; defaultStatements: string[] }
}) {
  const router = useRouter()
  const [sel, setSel] = useState<Selection>("welcome")
  const [items, setItems] = useState(blocks)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Ressincroniza a lista quando muda no servidor (add/remove/reorder)
  const signature = blocks.map((b) => b.id).join(",")
  const lastSig = useRef(signature)
  useEffect(() => {
    if (lastSig.current !== signature) {
      lastSig.current = signature
      setItems(blocks)
    }
  }, [signature, blocks])

  const selectedBlock = items.find((b) => b.id === sel)

  // ── reordenar (drag) ──
  function onDragOver(e: React.DragEvent, overId: string) {
    if (!draggingId) return
    e.preventDefault()
    if (draggingId === overId) return
    setItems((prev) => {
      const from = prev.findIndex((b) => b.id === draggingId)
      const to = prev.findIndex((b) => b.id === overId)
      if (from === -1 || to === -1 || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  function persistOrder() {
    const ordered = items.map((b) => b.id)
    if (ordered.join(",") !== signature) {
      startTransition(() => reorderBlocksAction(studyId, ordered))
    }
  }

  // ── excluir bloco ──
  function del(block: BuilderBlock) {
    startTransition(async () => {
      try {
        if (block.kind === "mission") await deleteMissionAction(studyId, block.missionId)
        else if (block.kind === "question") await deleteQuestionAction(studyId, block.questionId)
        else await deleteSusBlockAction(studyId, block.id)
        toast.success("Bloco removido")
        if (sel === block.id) setSel("welcome")
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível excluir.")
      }
    })
  }

  // ── adicionar SUS ──
  function addSus() {
    startTransition(async () => {
      try {
        await addSusBlockAction(studyId)
        toast.success("SUS adicionado")
        router.refresh()
      } catch (e) {
        if (isRedirect(e)) throw e
        toast.error("Não foi possível adicionar o SUS.")
      }
    })
  }

  const hasSus = items.some((b) => b.kind === "sus")

  // ── item da lista ──
  function Row({
    id,
    icon: Icon,
    label,
    sub,
    onDelete,
    draggable,
  }: {
    id: Selection
    icon: React.ElementType
    label: string
    sub?: string
    onDelete?: () => void
    draggable?: boolean
  }) {
    const active = sel === id
    const dragProps =
      draggable && editable
        ? {
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
              setDraggingId(id as string)
              e.dataTransfer.effectAllowed = "move"
            },
            onDragOver: (e: React.DragEvent) => onDragOver(e, id as string),
            onDrop: (e: React.DragEvent) => e.preventDefault(),
            onDragEnd: () => {
              setDraggingId(null)
              persistOrder()
            },
          }
        : {}
    return (
      <div
        {...dragProps}
        onClick={() => setSel(id)}
        className={cn(
          "group flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors",
          active
            ? "border-primary bg-primary/[0.04]"
            : "border-outline-variant bg-surface-container-low hover:border-on-surface-variant/40",
          draggingId === id && "opacity-50"
        )}
      >
        {draggable && editable && (
          <GripVertical className="h-4 w-4 text-on-surface-variant/50 cursor-grab active:cursor-grabbing shrink-0" />
        )}
        <div
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
            active ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body-medium text-on-surface truncate">{label}</p>
          {sub && <p className="text-label-small text-on-surface-variant truncate">{sub}</p>}
        </div>
        {onDelete && editable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error shrink-0"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
      {/* ── Coluna 1: lista de blocos (rola por dentro) ── */}
      <div className="space-y-2 lg:max-h-[calc(100svh-210px)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
        <Row id="welcome" icon={Sparkles} label="Boas-vindas" sub="Tela inicial" />

        {items.map((b, i) =>
          b.kind === "mission" ? (
            <Row
              key={b.id}
              id={b.id}
              icon={Flag}
              label={b.task || `Missão ${i + 1}`}
              sub="Tarefa"
              draggable
              onDelete={() => del(b)}
            />
          ) : b.kind === "question" ? (
            <Row
              key={b.id}
              id={b.id}
              icon={HelpCircle}
              label={b.title || "Pergunta"}
              sub={qLabel[b.qtype] ?? "Pergunta"}
              draggable
              onDelete={() => del(b)}
            />
          ) : (
            <Row
              key={b.id}
              id={b.id}
              icon={ClipboardCheck}
              label="Questionário SUS"
              sub="10 perguntas padrão"
              draggable
              onDelete={() => del(b)}
            />
          )
        )}

        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant py-3 text-body-medium text-primary hover:bg-primary/[0.04] cursor-pointer outline-none"
              )}
            >
              <Plus className="h-4 w-4" /> Adicionar bloco
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={() => setSel("new-mission")}>
                <Flag className="h-4 w-4 mr-2" />
                <div>
                  <p className="text-body-medium">Missão</p>
                  <p className="text-label-small text-on-surface-variant">Tarefa no protótipo</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSel("new-question")}>
                <HelpCircle className="h-4 w-4 mr-2" />
                <div>
                  <p className="text-body-medium">Pergunta</p>
                  <p className="text-label-small text-on-surface-variant">Aberta, escolha, estrelas, sim/não</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addSus} disabled={hasSus}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                <div>
                  <p className="text-body-medium">SUS {hasSus ? "(já adicionado)" : ""}</p>
                  <p className="text-label-small text-on-surface-variant">Questionário padrão de usabilidade</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Row id="thanks" icon={CheckCircle2} label="Obrigado" sub="Tela final" />
      </div>

      {/* ── Coluna 2: editor — altura acompanha o conteúdo, com teto = tela
          (rolagem interna quando passa; botão de salvar sempre visível) ── */}
      <div className="rounded-2xl border border-outline-variant bg-surface px-6 pt-6 pb-8 min-h-[300px] max-h-[calc(100svh-210px)] overflow-y-auto overflow-x-hidden no-scrollbar">
        {sel === "welcome" ? (
          <WelcomeEditor
            studyId={studyId}
            editable={editable}
            title={welcome.title}
            message={welcome.message}
            howItWorks={welcome.howItWorks}
            defaultTitle={welcome.defaultTitle}
          />
        ) : sel === "thanks" ? (
          <div className="space-y-2">
            <h2 className="text-title-medium text-on-surface">Tela de agradecimento</h2>
            <p className="text-body-medium text-on-surface-variant">
              Exibida ao final do teste. Texto padrão do idioma — sem edição por enquanto.
            </p>
          </div>
        ) : sel === "new-mission" ? (
          <MissionForm
            studyId={studyId}
            deviceType={deviceType}
            screens={missionScreens}
            figmaFileKey={figmaFileKey}
            stickyFooter
          />
        ) : sel === "new-question" ? (
          <QuestionEditor studyId={studyId} editable={editable} onSaved={() => setSel("welcome")} />
        ) : selectedBlock?.kind === "mission" ? (
          <MissionForm
            key={selectedBlock.missionId}
            studyId={studyId}
            missionId={selectedBlock.missionId}
            initial={selectedBlock.initial}
            deviceType={deviceType}
            screens={missionScreens}
            figmaFileKey={figmaFileKey}
            stickyFooter
          />
        ) : selectedBlock?.kind === "question" ? (
          <QuestionEditor
            key={selectedBlock.questionId}
            studyId={studyId}
            editable={editable}
            questionId={selectedBlock.questionId}
            initial={selectedBlock.initial}
          />
        ) : selectedBlock?.kind === "sus" ? (
          <SusEditor
            studyId={studyId}
            blockId={selectedBlock.id}
            editable={editable}
            statements={sus.statements}
            scaleOptions={sus.scaleOptions}
            defaultStatements={sus.defaultStatements}
            onDeleted={() => setSel("welcome")}
          />
        ) : (
          <p className="text-body-medium text-on-surface-variant">Selecione um bloco à esquerda.</p>
        )}
      </div>
    </div>
  )
}
