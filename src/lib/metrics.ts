// Métricas quantitativas de usabilidade (base NN/G, Tullis & Albert, Smith 1996).

// Mediana — mais fiel que a média para tempos (enviesados à direita).
export function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

// Lostness (Smith, 1996): quão "perdido" o participante ficou navegando.
//   N = telas ÚNICAS visitadas
//   S = TOTAL de telas visitadas (contando revisitas)
//   R = MÍNIMO de telas do caminho ótimo
//   L = sqrt( (N/S − 1)² + (R/N − 1)² )
// 0 = caminho perfeito; < 0,4 não-perdido; > 0,5 perdido.
export function lostness(uniqueVisited: number, totalVisited: number, optimalUnique: number): number | null {
  const N = uniqueVisited
  const S = totalVisited
  const R = optimalUnique
  if (N <= 0 || S <= 0 || R <= 0) return null
  const a = N / S - 1
  const b = R / N - 1
  return Math.sqrt(a * a + b * b)
}

// Faixa de interpretação do lostness.
export function lostnessBand(l: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (l < 0.4) return { label: "Não perdido", tone: "good" }
  if (l <= 0.5) return { label: "Intermediário", tone: "warn" }
  return { label: "Perdido", tone: "bad" }
}
