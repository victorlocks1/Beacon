"use client"
import { Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFigmaImageSync } from "@/components/prototype/figma-images-sync"

export interface QuestionScreenOption {
  id: string
  name: string
  order: number
  imageUrl: string
  figmaNodeId?: string | null
}

const NONE = "__none__"

// Campo "Tela exibida com a pergunta": o testador vê essa tela ao lado da
// pergunta enquanto responde. Opcional.
export function QuestionScreenField({
  studyId,
  screens,
  value,
  onChange,
}: {
  studyId?: string
  screens: QuestionScreenOption[]
  value: string | null
  onChange: (screenId: string | null) => void
}) {
  const screen = screens.find((s) => s.id === value) ?? null
  // Tela do Figma ainda sem imagem: baixa as que faltam para poder exibi-la.
  const needsImage = !!screen && !screen.imageUrl && !!screen.figmaNodeId && !!studyId
  const { running: loading, error: loadError } = useFigmaImageSync(studyId ?? "", needsImage ? 1 : 0)

  if (screens.length === 0) return null
  const label = (s: QuestionScreenOption) => `Tela ${s.order + 1}: ${s.name}`

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-title-small text-on-surface-variant">Tela exibida com a pergunta</p>
        <p className="text-body-small text-on-surface-variant mt-0.5">
          Opcional. O testador vê essa tela junto com a pergunta enquanto responde.
        </p>
      </div>
      <Select
        value={screen?.id ?? NONE}
        onValueChange={(v) => onChange(v && v !== NONE ? (v as string) : null)}
        items={{ [NONE]: "Nenhuma tela", ...Object.fromEntries(screens.map((s) => [s.id, label(s)])) }}
      >
        <SelectTrigger className="w-full h-12 rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Nenhuma tela</SelectItem>
          {screens.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {label(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {screen &&
        (screen.imageUrl ? (
          <div className="max-h-48 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screen.imageUrl} alt={screen.name} className="w-full h-auto block" />
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-body-small text-on-surface-variant">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading
              ? "Carregando a imagem da tela…"
              : loadError
                ? `Não foi possível carregar a imagem desta tela: ${loadError}`
                : "Esta tela ainda não tem imagem; ela só aparece para o testador depois de carregada."}
          </p>
        ))}
    </div>
  )
}
