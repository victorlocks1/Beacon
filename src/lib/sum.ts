// ─────────────────────────────────────────────────────────────────────────
// SUM — Single Usability Metric (Sauro & Kindlund, 2005)
// Condensa 4 dimensões de usabilidade POR TAREFA num único número (0..100%):
//   1. Conclusão   — concluiu a tarefa? (direto/indireto = sim)
//   2. Tempo       — tempo real vs. tempo ideal (KLM)
//   3. Erros       — misclicks + desvio, sobre as oportunidades de erro
//   4. Satisfação  — SEQ (Single Ease Question), escala 1..7
// A SUM da tarefa é a MÉDIA das dimensões coletadas (pesos iguais).
// ─────────────────────────────────────────────────────────────────────────

export type SumLang = "pt" | "es"

// Pergunta SEQ padrão por idioma (editável pelo criador).
export const SEQ_STATEMENT: Record<SumLang, string> = {
  pt: "De modo geral, quão fácil ou difícil foi concluir esta tarefa?",
  es: "En general, ¿qué tan fácil o difícil fue completar esta tarea?",
}

// Âncoras das pontas da escala SEQ (1 e 7).
export const SEQ_ANCHORS: Record<SumLang, { low: string; high: string }> = {
  pt: { low: "Muito difícil", high: "Muito fácil" },
  es: { low: "Muy difícil", high: "Muy fácil" },
}

export function seqStatementFor(lang: SumLang, custom?: string | null): string {
  const c = custom?.trim()
  return c && c.length > 0 ? c : SEQ_STATEMENT[lang]
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
  ease?: number | null // resposta SEQ 1..7 (ausente = dimensão não coletada)
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

  // Satisfação: SEQ normalizada (1..7 → 0..100).
  let satisfaction: number | null = null
  if (typeof i.ease === "number" && i.ease >= 1) {
    satisfaction = clamp01((i.ease - 1) / 6) * 100
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
