"use client"
import { Trash2 } from "lucide-react"

// Passo de um caminho esperado, editável no criador. `optional` e `matchByName`
// deixam o caminho robusto sem enumerar cada variação de rota.
export interface PathStepInput {
  screenId: string
  optional: boolean
  matchByName: boolean
}

// Converte uma gravação (sequência de screenIds) em passos com flags padrão.
export function toSteps(ids: string[]): PathStepInput[] {
  return ids.map((screenId) => ({ screenId, optional: false, matchByName: false }))
}

// Lista os caminhos salvos, cada passo com toggles de "opcional" e "qualquer do
// grupo" (mesmo nome). O 1º passo (início) e o último (objetivo) não podem ser
// opcionais — são essenciais para a tarefa.
export function SavedPaths({
  paths,
  onChange,
  screenName,
  nameCount,
}: {
  paths: PathStepInput[][]
  onChange: (paths: PathStepInput[][]) => void
  screenName: (id: string) => string
  // quantas telas do protótipo têm este nome (para só oferecer "grupo" quando faz sentido)
  nameCount: (id: string) => number
}) {
  if (paths.length === 0) return null

  function updateStep(pi: number, si: number, patch: Partial<PathStepInput>) {
    onChange(
      paths.map((p, i) =>
        i !== pi ? p : p.map((st, j) => (j !== si ? st : { ...st, ...patch }))
      )
    )
  }

  return (
    <div className="space-y-2">
      {paths.map((path, pi) => (
        <div key={pi} className="border rounded-lg p-2.5 bg-muted/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-xs">Caminho {pi + 1}</span>
            <button
              type="button"
              onClick={() => onChange(paths.filter((_, i) => i !== pi))}
              className="text-red-400 hover:text-red-600 shrink-0"
              aria-label="Remover caminho"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {path.map((step, si) => {
              const isFirst = si === 0
              const isLast = si === path.length - 1
              const group = nameCount(step.screenId) > 1
              return (
                <div key={si} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-4 tabular-nums">{si + 1}.</span>
                  <span className="px-1.5 py-0.5 rounded bg-background border flex-1 truncate">
                    {screenName(step.screenId)}
                    {isFirst && <span className="text-muted-foreground ml-1">(início)</span>}
                    {isLast && <span className="text-muted-foreground ml-1">(objetivo)</span>}
                  </span>
                  {!isFirst && !isLast && (
                    <label className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={step.optional}
                        onChange={(e) => updateStep(pi, si, { optional: e.target.checked })}
                      />
                      opcional
                    </label>
                  )}
                  {group && (
                    <label
                      className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap"
                      title={`Casa qualquer tela chamada "${screenName(step.screenId)}"`}
                    >
                      <input
                        type="checkbox"
                        checked={step.matchByName}
                        onChange={(e) => updateStep(pi, si, { matchByName: e.target.checked })}
                      />
                      qualquer do grupo
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
