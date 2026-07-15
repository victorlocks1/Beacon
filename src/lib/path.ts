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
 * Reclassifica uma execução de CAMINHO EXATO a partir do caminho percorrido.
 *  • "direct"   = percorreu o caminho exato até a tela-objetivo SEM desvio — o
 *                 caminho definido é um PREFIXO do caminho real. Navegação DEPOIS
 *                 de chegar no objetivo é ignorada (a tarefa já concluiu ali).
 *  • "indirect" = passou por todas as telas do caminho, na ordem (subsequência),
 *                 mas com desvios/telas extras no meio antes do objetivo.
 *  • null       = não percorreu nenhum caminho (pulou tela-chave) → não é sucesso.
 * `actual` deve vir sem repetições consecutivas (reconstructPath já garante).
 */
export function classifyExactPath(
  actual: string[],
  expectedPaths: string[][]
): "direct" | "indirect" | null {
  let indirect = false
  for (const p of expectedPaths) {
    if (p.length < 2) continue
    // DIRETO: o caminho definido é um prefixo do caminho real (chegou no objetivo
    // limpo, sem telas extras até ali; o que fez depois não importa).
    if (p.length <= actual.length && p.every((x, i) => actual[i] === x)) return "direct"
    // INDIRETO: todas as telas de `p` aparecem em `actual`, na ordem (subsequência).
    let i = 0
    for (const s of actual) {
      if (i < p.length && s === p[i]) i++
    }
    if (i === p.length) indirect = true
  }
  return indirect ? "indirect" : null
}
