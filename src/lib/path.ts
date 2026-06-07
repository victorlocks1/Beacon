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
