// System Usability Scale (SUS) — questionário padrão de 10 itens, escala 1..5.
// As afirmações NÃO podem ser alteradas (padrão do método).

export const SUS_ITEM_COUNT = 10
export const SUS_THRESHOLD = 70 // nota mínima considerada "boa" (handoff)

type Lang = "pt" | "es"

// 10 afirmações padrão (ímpares positivas, pares negativas). Base em espanhol
// (fornecida pelo time) e tradução PT-BR — mantêm "solução digital".
export const SUS_STATEMENTS: Record<Lang, string[]> = {
  pt: [
    "Acho que usaria esta solução digital com frequência.",
    "Achei esta solução digital desnecessariamente complexa.",
    "Achei esta solução digital fácil de usar.",
    "Acho que precisaria do suporte de uma pessoa técnica ou mais experiente para usar esta solução digital.",
    "Achei que as diversas funções desta solução digital estavam bem integradas.",
    "Achei que havia muita inconsistência nesta solução digital.",
    "Imagino que a maioria das pessoas aprenderia a usar esta solução digital rapidamente.",
    "Achei esta solução digital muito atrapalhada de usar.",
    "Senti-me muito seguro(a) ao usar esta solução digital.",
    "Precisei aprender muitas coisas antes de poder usar esta solução digital.",
  ],
  es: [
    "Creo que usaría esta solución digital frecuentemente.",
    "Encontré la solución innecesariamente compleja.",
    "Encontré esta solución digital fácil de usar.",
    "Creo que necesitaría soporte de una persona técnica o más experimentada para usar esta solución digital.",
    "Encontré que las diversas funciones de esta solución digital estaban bien integradas.",
    "Encontré que había mucha inconsistencia en esta solución digital.",
    "Imagino que la mayoría de las personas aprendería a usar esta solución digital rápidamente.",
    "Encontré esta solución digital muy torpe de usar.",
    "Me sentí muy seguro(a) al usar esta solución digital.",
    "Necesité aprender muchas cosas antes de poder usar esta solución digital.",
  ],
}

// 5 opções nomeadas (1..5).
export const SUS_OPTIONS: Record<Lang, string[]> = {
  pt: ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"],
  es: ["Totalmente en desacuerdo", "En desacuerdo", "Neutro", "De acuerdo", "Totalmente de acuerdo"],
}

// Resolve os enunciados: usa os customizados do estudo se válidos (10 não-vazios),
// senão o padrão do idioma. Aceita Json vindo do banco.
export function susStatementsFor(lang: Lang, custom: unknown): string[] {
  if (
    Array.isArray(custom) &&
    custom.length === SUS_ITEM_COUNT &&
    custom.every((s) => typeof s === "string" && s.trim())
  ) {
    return custom as string[]
  }
  return SUS_STATEMENTS[lang]
}

export const SUS_INTRO: Record<Lang, { title: string; body: string }> = {
  pt: {
    title: "Quase lá! Uma última avaliação",
    body: "Marque o quanto você concorda com cada afirmação sobre sua experiência. Não há certo ou errado.",
  },
  es: {
    title: "¡Casi listo! Una última evaluación",
    body: "Marca cuánto estás de acuerdo con cada afirmación sobre tu experiencia. No hay respuestas correctas o incorrectas.",
  },
}

// Cálculo oficial do SUS: itens ímpares valem (v-1), pares valem (5-v); soma × 2.5.
export function susScore(values: number[]): number {
  let sum = 0
  for (let i = 0; i < SUS_ITEM_COUNT; i++) {
    const v = values[i] ?? 0
    sum += i % 2 === 0 ? v - 1 : 5 - v
  }
  return Math.round(sum * 2.5 * 10) / 10
}

// Interpretação (adjetivo + se atinge o corte de 70). Faixas heurísticas
// alinhadas ao padrão (Bangor/Sauro) e ao corte interno de handoff.
export function susVerdict(score: number, lang: Lang): { label: string; good: boolean } {
  const good = score >= SUS_THRESHOLD
  const t = {
    pt: { excellent: "Excelente", good: "Bom", ok: "Regular", poor: "Ruim" },
    es: { excellent: "Excelente", good: "Bueno", ok: "Regular", poor: "Malo" },
  }[lang]
  const label = score >= 85 ? t.excellent : score >= 70 ? t.good : score >= 50 ? t.ok : t.poor
  return { label, good }
}
