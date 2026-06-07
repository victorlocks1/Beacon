export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "—"
  const totalSec = ms / 1000
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`
  const min = Math.floor(totalSec / 60)
  const sec = Math.round(totalSec % 60)
  return `${min}m ${sec}s`
}

export function formatPct(value: number): string {
  return `${Math.round(value)}%`
}
