// ─────────────────────────────────────────────────────────────────────────
// SUM — Single Usability Metric (Sauro & Kindlund, 2005)
// Condensa 4 dimensões de usabilidade POR TAREFA num único número (0..100%):
//   1. Conclusão   — concluiu a tarefa? (direto/indireto = sim)
//   2. Tempo       — tempo real vs. tempo ideal (KLM)
//   3. Erros       — misclicks + desvio, sobre as oportunidades de erro
//   4. Satisfação  — ASQ (After-Scenario Questionnaire): 3 perguntas 1..7
// A SUM da tarefa é a MÉDIA das dimensões coletadas (pesos iguais).
// ─────────────────────────────────────────────────────────────────────────

export type SumLang = "pt" | "es"

export const SUM_QUESTION_COUNT = 3

// As 3 perguntas do ASQ (ordem: tempo, informação, facilidade), por idioma.
// Editáveis pelo criador.
export const ASQ_STATEMENTS: Record<SumLang, string[]> = {
  pt: [
    "Como você avalia o tempo que levou para concluir a tarefa?",
    "Como você avalia a quantidade de informações disponíveis para concluir a tarefa?",
    "Como você avalia a facilidade para concluir a tarefa?",
  ],
  es: [
    "¿Cómo evalúas el tiempo que te llevó completar la tarea?",
    "¿Cómo evalúas la cantidad de información disponible para completar la tarea?",
    "¿Cómo evalúas la facilidad para completar la tarea?",
  ],
}

// Rótulos curtos de cada dimensão do ASQ (p/ tabelas/resultados).
export const ASQ_LABELS: Record<SumLang, string[]> = {
  pt: ["Tempo", "Informação", "Facilidade"],
  es: ["Tiempo", "Información", "Facilidad"],
}

// Âncoras das pontas da escala (1 e 7).
export const ASQ_ANCHORS: Record<SumLang, { low: string; high: string }> = {
  pt: { low: "Muito ruim", high: "Muito bom" },
  es: { low: "Muy malo", high: "Muy bueno" },
}

// Enunciados resolvidos: custom (array de 3 válido) ou padrão do idioma.
export function asqStatementsFor(lang: SumLang, custom?: unknown): string[] {
  if (
    Array.isArray(custom) &&
    custom.length === SUM_QUESTION_COUNT &&
    custom.every((s) => typeof s === "string" && s.trim().length > 0)
  ) {
    return (custom as string[]).map((s) => s.trim())
  }
  return ASQ_STATEMENTS[lang]
}

// ── KLM: tempo ideal (execução perfeita, sem erros) ──
// Operadores usados: apontar (P=1,1s) + toque (0,1s) + decisão mental (M=1,35s)
// por passo, mais uma leitura inicial fixa (~2s).
const KLM_READ_MS = 2000
const KLM_PER_TAP_MS = 1100 + 100 + 1350 // P + tap + M = 2,55s

// taps = nº de transições do caminho exato (telas - 1). Sem caminho, 0.
export function klmIdealMs(taps: number): number {
  if (taps <= 0) return 0
  return Math.round(KLM_READ_MS + taps * KLM_PER_TAP_MS)
}

// Tempo ideal efetivo: override manual do criador, senão estimativa KLM.
export function idealTimeMs(override: number | null | undefined, taps: number): number {
  if (typeof override === "number" && override > 0) return override
  return klmIdealMs(taps)
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export interface SumInput {
  completed: boolean // direto ou indireto
  indirect: boolean // desviou do caminho (conta como 1 erro de navegação)
  durationMs: number
  misclicks: number
  // respostas do ASQ (1..7 cada). Vazio/ausente = dimensão não coletada.
  satisfactionValues?: number[] | null
  idealMs: number // tempo ideal (KLM ou override); 0 = sem dimensão Tempo
  idealTaps: number // oportunidades de erro (~ toques do caminho ideal)
}

export interface SumBreakdown {
  completion: number // 0..100
  time: number | null // 0..100 (null = não avaliado)
  errors: number | null // 0..100
  satisfaction: number | null // 0..100
  score: number // 0..100 (média das dimensões disponíveis)
}

// SUM de UMA execução (participante × tarefa).
export function sumScore(i: SumInput): SumBreakdown {
  const completion = i.completed ? 100 : 0

  // Tempo: eficiência = ideal/real (só quando há tempo ideal e a tarefa foi concluída).
  let time: number | null = null
  if (i.idealMs > 0 && i.completed && i.durationMs > 0) {
    time = clamp01(i.idealMs / i.durationMs) * 100
  }

  // Erros: 1 − erros/oportunidades. Oportunidades ~ toques do caminho ideal (mín. 1).
  let errors: number | null = null
  const opportunities = Math.max(1, i.idealTaps)
  if (i.idealTaps > 0) {
    const errCount = i.misclicks + (i.indirect ? 1 : 0)
    errors = clamp01(1 - errCount / opportunities) * 100
  }

  // Satisfação: média das 3 respostas do ASQ (1..7 → 0..100 cada).
  let satisfaction: number | null = null
  const vals = (i.satisfactionValues ?? []).filter((v) => typeof v === "number" && v >= 1)
  if (vals.length > 0) {
    const norm = vals.map((v) => clamp01((v - 1) / 6) * 100)
    satisfaction = norm.reduce((a, b) => a + b, 0) / norm.length
  }

  const parts = [completion, time, errors, satisfaction].filter(
    (v): v is number => v !== null
  )
  const score = parts.reduce((a, b) => a + b, 0) / parts.length

  return { completion, time, errors, satisfaction, score }
}

// Média de várias execuções, dimensão a dimensão (ignora dimensões ausentes).
export function sumAverage(rows: SumBreakdown[]): SumBreakdown {
  const avg = (pick: (r: SumBreakdown) => number | null): number | null => {
    const vals = rows.map(pick).filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const completion = avg((r) => r.completion) ?? 0
  const time = avg((r) => r.time)
  const errors = avg((r) => r.errors)
  const satisfaction = avg((r) => r.satisfaction)
  const parts = [completion, time, errors, satisfaction].filter(
    (v): v is number => v !== null
  )
  const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0
  return { completion, time, errors, satisfaction, score }
}

// Faixas de interpretação da SUM (calibráveis).
export function sumVerdict(score: number): { label: string; band: "great" | "good" | "ok" | "bad" } {
  if (score >= 80) return { label: "Excelente", band: "great" }
  if (score >= 65) return { label: "Bom", band: "good" }
  if (score >= 50) return { label: "Regular", band: "ok" }
  return { label: "Problema de usabilidade", band: "bad" }
}
