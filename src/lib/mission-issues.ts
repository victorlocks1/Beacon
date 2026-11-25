// O que falta para uma tarefa poder ser testada. Uma tarefa fica incompleta
// quando telas ligadas a ela são excluídas (a tarefa nunca é excluída junto) ou
// quando foi salva sem critério. Tarefa incompleta é sinalizada no construtor e
// bloqueia a publicação.
export function missionIssues(m: {
  startScreenId: string | null
  successType: string
  goals: unknown[]
  goalHotspots: unknown[]
  paths: { steps: unknown[] }[]
}): string[] {
  const issues: string[] = []
  if (!m.startScreenId) issues.push("sem tela inicial")
  if (m.successType === "screen" && m.goals.length === 0) issues.push("sem tela de sucesso")
  if (m.successType === "hotspot" && m.goalHotspots.length === 0) issues.push("sem hotspot de sucesso")
  if (m.successType === "path" && !m.paths.some((p) => p.steps.length >= 2)) issues.push("sem caminho esperado")
  return issues
}
