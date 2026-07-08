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
 * Reclassifica uma execução de CAMINHO EXATO a partir do caminho percorrido,
 * pela regra atual: precisa percorrer TODAS as telas de um caminho definido, na
 * ordem (subsequência), terminando na tela-objetivo (última do caminho).
 *  • "direct"   = percorreu um caminho exatamente igual (sem telas extras)
 *  • "indirect" = percorreu todas as telas do caminho, na ordem, com telas extras
 *  • null       = não percorreu nenhum caminho (pulou tela-chave) → não é sucesso
 * `actual` deve vir sem repetições consecutivas (reconstructPath já garante).
 */
export function classifyExactPath(
  actual: string[],
  expectedPaths: string[][]
): "direct" | "indirect" | null {
  let indirect = false
  for (const p of expectedPaths) {
    if (p.length < 2) continue
    if (arraysEqual(actual, p)) return "direct"
    // subsequência: todas as telas de `p` aparecem em `actual`, na ordem
    let i = 0
    for (const s of actual) {
      if (i < p.length && s === p[i]) i++
    }
    if (i === p.length) indirect = true
  }
  return indirect ? "indirect" : null
}
