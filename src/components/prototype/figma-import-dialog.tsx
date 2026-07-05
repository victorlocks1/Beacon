"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { M3TextField } from "@/components/ui/m3-text-field"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import {
  X,
  Loader2,
  ExternalLink,
  Check,
  Star,
  ArrowRight,
} from "lucide-react"
import {
  getFigmaConnectionAction,
  saveFigmaTokenAction,
  figmaInspectAction,
  figmaImportAction,
} from "@/app/(dashboard)/studies/[id]/figma/actions"
import type { ImportScreen } from "@/lib/figma"

type Step = "loading" | "connect" | "url" | "review" | "importing" | "done"

export function FigmaImportDialog({ studyId }: { studyId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("loading")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [token, setToken] = useState("")
  const [url, setUrl] = useState("")
  const [fileKey, setFileKey] = useState("")
  const [screens, setScreens] = useState<ImportScreen[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [startId, setStartId] = useState<string | null>(null)
  const [result, setResult] = useState<{ screens: number; hotspots: number } | null>(null)

  function reset() {
    setStep("loading")
    setBusy(false)
    setError(null)
    setToken("")
    setUrl("")
    setScreens([])
    setSelected(new Set())
    setStartId(null)
    setResult(null)
  }

  async function onOpenChange(v: boolean) {
    setOpen(v)
    if (v) {
      reset()
      try {
        const { connected } = await getFigmaConnectionAction()
        setStep(connected ? "url" : "connect")
      } catch {
        setStep("connect")
      }
    }
  }

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      await saveFigmaTokenAction(token)
      setStep("url")
      toast.success("Figma conectado")
    } catch (e) {
      setError(msg(e) || "Token inválido. Confira e tente de novo.")
      toast.error("Não foi possível conectar ao Figma.")
    } finally {
      setBusy(false)
    }
  }

  async function inspect() {
    setBusy(true)
    setError(null)
    try {
      const res = await figmaInspectAction(studyId, url)
      setFileKey(res.fileKey)
      setScreens(res.screens)
      setSelected(new Set(res.screens.map((s) => s.figmaId)))
      setStartId(res.screens.find((s) => s.isStart)?.figmaId ?? null)
      setStep("review")
    } catch (e) {
      setError(msg(e) || "Não consegui ler esse protótipo.")
      toast.error("Não consegui ler esse protótipo.")
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    setBusy(true)
    setError(null)
    setStep("importing")
    try {
      const chosen = screens
        .filter((s) => selected.has(s.figmaId))
        .map((s) => ({ ...s, isStart: s.figmaId === startId }))
      const res = await figmaImportAction(studyId, fileKey, chosen)
      setResult(res)
      setStep("done")
      router.refresh()
      toast.success(`${res.screens} tela(s) importada(s)`)
    } catch (e) {
      setError(msg(e) || "Falha na importação.")
      setStep("review")
      toast.error("Falha na importação.")
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}>
        <FigmaGlyph className="w-4 h-4 mr-2" />
        Importar do Figma
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl rounded-[28px] p-0 gap-0 ring-0 border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      >
        <div className="flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 shrink-0">
            <div>
              <DialogTitle className="text-[22px] leading-7 font-semibold text-on-surface flex items-center gap-2">
                <FigmaGlyph className="w-5 h-5" />
                Importar do Figma
              </DialogTitle>
              <p className="text-body-small text-on-surface-variant mt-1">
                {step === "connect" && "Conecte sua conta do Figma uma vez."}
                {step === "url" && "Cole o link da página ou do protótipo."}
                {step === "review" && "Escolha as telas que entram no estudo."}
                {(step === "importing" || step === "done") && "Quase lá."}
              </p>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" />}>
              <X />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </div>

          <div className="px-6 pb-6 overflow-y-auto subtle-scroll">
            {error && (
              <p className="mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-body-small text-error">
                {error}
              </p>
            )}

            {step === "loading" && (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
              </div>
            )}

            {/* 1) Conectar token */}
            {step === "connect" && (
              <div className="space-y-5">
                <ol className="space-y-2 text-body-medium text-on-surface-variant list-decimal pl-5">
                  <li>
                    Abra{" "}
                    <a
                      href="https://www.figma.com/settings"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                    >
                      figma.com/settings <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    → aba <strong>Security</strong> → <strong>Personal access tokens</strong>.
                  </li>
                  <li>Gere um token (escopos de leitura: <code>file_content:read</code>).</li>
                  <li>Cole o token aqui — fica salvo e criptografado só na sua conta.</li>
                </ol>
                <M3TextField
                  label="Personal Access Token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  labelBg="bg-popover"
                  autoFocus
                />
                <div className="flex justify-end">
                  <Button onClick={connect} disabled={busy || !token.trim()}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Conectar
                  </Button>
                </div>
              </div>
            )}

            {/* 2) URL */}
            {step === "url" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-body-small text-emerald-700">
                  <Check className="h-4 w-4" /> Figma conectado
                </div>
                <M3TextField
                  label="Link do Figma (página ou protótipo)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  labelBg="bg-popover"
                  autoFocus
                />
                <p className="text-body-small text-on-surface-variant -mt-2">
                  Dica: selecione a página do protótipo no Figma e use “Copy link”. Lemos só
                  aquele escopo, não o arquivo inteiro.
                </p>
                <div className="flex justify-end">
                  <Button onClick={inspect} disabled={busy || !url.trim()}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Inspecionar
                    {!busy && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </div>
              </div>
            )}

            {/* 3) Revisão */}
            {step === "review" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-body-small text-on-surface-variant">
                    {selected.size} de {screens.length} telas selecionadas · clique no ★ para a
                    tela inicial
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        selected.size === screens.length
                          ? new Set()
                          : new Set(screens.map((s) => s.figmaId))
                      )
                    }
                    className="text-body-small text-primary hover:underline"
                  >
                    {selected.size === screens.length ? "Limpar" : "Selecionar todas"}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {screens.map((s) => {
                    const on = selected.has(s.figmaId)
                    const isStart = startId === s.figmaId
                    return (
                      <div
                        key={s.figmaId}
                        className={cn(
                          "relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-colors",
                          on ? "border-primary" : "border-outline-variant opacity-60"
                        )}
                        onClick={() => toggle(s.figmaId)}
                      >
                        <div className="aspect-[9/16] bg-surface-container-high flex items-center justify-center overflow-hidden">
                          {s.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.thumbUrl} alt={s.name} className="w-full h-full object-cover object-top" />
                          ) : (
                            <span className="text-label-small text-on-surface-variant">sem preview</span>
                          )}
                        </div>
                        {on && (
                          <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setStartId(isStart ? null : s.figmaId)
                          }}
                          title="Definir como tela inicial"
                          className={cn(
                            "absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center",
                            isStart ? "bg-amber-400 text-black" : "bg-black/40 text-white"
                          )}
                        >
                          <Star className="h-3.5 w-3.5" fill={isStart ? "currentColor" : "none"} />
                        </button>
                        <div className="px-2 py-1.5">
                          <p className="text-label-medium text-on-surface truncate">{s.name}</p>
                          <p className="text-label-small text-on-surface-variant">
                            {s.hotspots.length} hotspots
                            {s.scroll !== "none" ? " · scroll" : ""}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={runImport} disabled={busy || selected.size === 0}>
                    Importar {selected.size} {selected.size === 1 ? "tela" : "telas"}
                  </Button>
                </div>
              </div>
            )}

            {/* 4) Importando / pronto */}
            {step === "importing" && (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-body-medium text-on-surface-variant">
                  Exportando e importando as telas…
                </p>
              </div>
            )}

            {step === "done" && result && (
              <div className="py-10 flex flex-col items-center gap-3 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Check className="h-6 w-6" />
                </div>
                <p className="text-title-medium text-on-surface">Importação concluída!</p>
                <p className="text-body-medium text-on-surface-variant">
                  {result.screens} telas e {result.hotspots} hotspots criados.
                </p>
                <DialogClose render={<Button className="mt-2" />}>Ver telas</DialogClose>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : ""
}

function FigmaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M8.5 3A2.5 2.5 0 0 0 8.5 8H11V3H8.5zM13 3v5h2.5a2.5 2.5 0 0 0 0-5H13zM8.5 9.5A2.5 2.5 0 0 0 8.5 14.5H11v-5H8.5zM13 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0zM8.5 16A2.5 2.5 0 1 0 11 18.5V16H8.5z" />
    </svg>
  )
}
