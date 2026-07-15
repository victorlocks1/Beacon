// ─────────────────────────────────────────────────────────────────────────
// Estrutura de "relatório" neutra, montada no servidor e serializada no cliente
// para Markdown / Excel (.xlsx) / PDF. Mantém os dados organizados por seções.
// ─────────────────────────────────────────────────────────────────────────

export type ReportSection =
  | { heading: string; kind: "keyvalue"; pairs: [string, string][] }
  | { heading: string; kind: "table"; columns: string[]; rows: (string | number)[][] }
  | { heading: string; kind: "list"; items: string[] }
  | { heading: string; kind: "text"; text: string }

export interface Report {
  title: string
  subtitle?: string
  sections: ReportSection[]
}

// ── Markdown (puro, sem dependência) ──
export function reportToMarkdown(r: Report): string {
  const out: string[] = [`# ${r.title}`]
  if (r.subtitle) out.push(``, `_${r.subtitle}_`)
  for (const s of r.sections) {
    out.push(``, `## ${s.heading}`)
    if (s.kind === "keyvalue") {
      for (const [k, v] of s.pairs) out.push(`- **${k}:** ${v}`)
    } else if (s.kind === "table") {
      out.push(``, `| ${s.columns.join(" | ")} |`, `| ${s.columns.map(() => "---").join(" | ")} |`)
      for (const row of s.rows) out.push(`| ${row.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`)
    } else if (s.kind === "list") {
      if (s.items.length === 0) out.push(`_(sem respostas)_`)
      for (const it of s.items) out.push(`- ${it.replace(/\n/g, " ")}`)
    } else if (s.kind === "text") {
      out.push(s.text)
    }
  }
  return out.join("\n") + "\n"
}

// ── Perguntas → seções (reaproveitado em missão e perguntas gerais) ──
export type ReportQuestion = {
  type: string // open | choice | rating | binary
  title: string
  options?: unknown
  answers: { text: string | null; choice: string | null; rating: number | null }[]
}

const qKindLabel: Record<string, string> = {
  open: "aberta",
  choice: "escolha",
  rating: "estrelas",
  binary: "sim/não",
}

export function questionReportSection(q: ReportQuestion): ReportSection {
  const heading = `Pergunta (${qKindLabel[q.type] ?? q.type}): ${q.title}`
  const answers = q.answers ?? []

  if (q.type === "open") {
    const texts = answers
      .map((a) => a.text?.trim())
      .filter((t): t is string => !!t)
    return { heading, kind: "list", items: texts }
  }

  if (q.type === "rating") {
    const rs = answers.map((a) => a.rating).filter((n): n is number => typeof n === "number")
    const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null
    const dist = [1, 2, 3, 4, 5].map((n) => rs.filter((r) => r === n).length)
    return {
      heading,
      kind: "table",
      columns: ["Nota", "Respostas"],
      rows: [
        ...dist.map((c, i) => [`${i + 1} estrela(s)`, c] as (string | number)[]),
        ["Média", avg == null ? "—" : avg.toFixed(1)],
        ["Total", rs.length],
      ],
    }
  }

  // choice / binary
  const opts: string[] = q.type === "binary" ? ["yes", "no"] : ((q.options as string[] | null) ?? [])
  const labelOf = (o: string) => (q.type === "binary" ? (o === "yes" ? "Sim" : "Não") : o)
  const total = answers.filter((a) => !!a.choice).length
  const rows = opts.map((o) => {
    const c = answers.filter((a) => a.choice === o).length
    return [labelOf(o), c, total ? `${Math.round((c / total) * 100)}%` : "0%"] as (string | number)[]
  })
  return { heading, kind: "table", columns: ["Opção", "Respostas", "%"], rows }
}
