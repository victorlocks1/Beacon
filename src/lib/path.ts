/** Remove repetições consecutivas de uma sequência de telas. */
export function dedupeConsecutive(ids: string[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    if (out[out.length - 1] !== id) out.push(id)
  }
  return out
}

/** Reconstrói o caminho percorrido a partir de eventos de navegação. */
export function reconstructPath(
  navEvents: { targetScreenId: string | null }[]
): string[] {
  return dedupeConsecutive(
    navEvents
      .map((e) => e.targetScreenId)
      .filter((s): s is string => !!s)
  )
}

export function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Passo de um caminho exato, já "resolvido" para classificação:
 *  • `ids`      = telas que satisfazem o passo. Normalmente 1 (a tela específica);
 *                 para "qualquer tela do grupo" (matchByName), é o conjunto de todas
 *                 as telas com o mesmo nome (ex.: os 13 frames "Preview Profile").
 *  • `optional` = o testador PODE passar por ele ou não, sem virar "indireto"
 *                 (ex.: abrir o perfil antes do WhatsApp — tanto faz).
 */
export type PathStepDef = { ids: string[]; optional?: boolean }

/**
 * Resolve os caminhos definidos (do banco) em `PathStepDef[][]` para classificação:
 *  • `matchByName` → expande o passo para TODAS as telas com o mesmo nome (grupo).
 *  • `optional`    → marca o passo como opcional.
 * `screens` é a lista de telas do estudo (id + nome), usada só para o agrupamento
 * por nome. Retrocompatível: passos antigos (optional/matchByName ausentes = false,
 * 1 tela cada) viram exatamente a sequência clássica.
 */
export function buildExactPaths(
  paths: { steps: { screenId: string; optional?: boolean; matchByName?: boolean }[] }[],
  screens: { id: string; name: string }[]
): PathStepDef[][] {
  const nameById = new Map(screens.map((s) => [s.id, s.name]))
  const idsByName = new Map<string, string[]>()
  for (const s of screens) {
    const arr = idsByName.get(s.name) ?? []
    arr.push(s.id)
    idsByName.set(s.name, arr)
  }
  return paths.map((p) =>
    p.steps.map((st) => ({
      ids: st.matchByName
        ? idsByName.get(nameById.get(st.screenId) ?? "") ?? [st.screenId]
        : [st.screenId],
      optional: st.optional ?? false,
    }))
  )
}

/** Um passo casa a tela `id` se `id` está entre as telas aceitas do passo. */
function stepMatches(step: PathStepDef, id: string): boolean {
  return step.ids.includes(id)
}

/**
 * DIRETO: consome um PREFIXO de `actual` casando cada passo na ordem. Passos
 * opcionais podem ser pulados (sem consumir tela). NENHUMA tela extra pode ser
 * consumida — se a tela atual não casa o passo obrigatório, não é direto.
 * Telas DEPOIS do último passo (objetivo) são ignoradas (a tarefa já concluiu).
 */
function isDirectPrefix(actual: string[], steps: PathStepDef[]): boolean {
  let i = 0
  for (const step of steps) {
    if (i < actual.length && stepMatches(step, actual[i])) i++
    else if (step.optional) continue // pula o opcional, não consome tela
    else return false
  }
  return true
}

/** INDIRETO: os passos OBRIGATÓRIOS aparecem em `actual`, na ordem (subsequência). */
function requiredSubsequence(actual: string[], steps: PathStepDef[]): boolean {
  const req = steps.filter((s) => !s.optional)
  if (req.length === 0) return false
  let k = 0
  for (const id of actual) {
    if (k < req.length && stepMatches(req[k], id)) k++
  }
  return k === req.length
}

/**
 * Reclassifica uma execução de CAMINHO EXATO a partir do caminho percorrido.
 *  • "direct"   = percorreu o caminho exato até o objetivo SEM desvio (prefixo,
 *                 pulando passos opcionais). Navegação após o objetivo é ignorada.
 *  • "indirect" = passou por todas as telas OBRIGATÓRIAS na ordem (subsequência),
 *                 mas com desvios/telas extras no meio.
 *  • null       = não percorreu nenhum caminho (pulou tela-chave) → não é sucesso.
 * `actual` deve vir sem repetições consecutivas (reconstructPath já garante).
 * Retrocompatível: caminhos "clássicos" (todos os passos obrigatórios, 1 tela
 * cada) se comportam exatamente como antes (prefixo/subsequência simples).
 */
export function classifyExactPath(
  actual: string[],
  expectedPaths: PathStepDef[][]
): "direct" | "indirect" | null {
  let indirect = false
  for (const p of expectedPaths) {
    if (p.length < 2) continue
    if (isDirectPrefix(actual, p)) return "direct"
    if (requiredSubsequence(actual, p)) indirect = true
  }
  return indirect ? "indirect" : null
}
