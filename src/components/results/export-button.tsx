"use client"
import { useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, FileText, FileType2, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/toast"
import { reportToMarkdown, type Report, type ReportSection } from "@/lib/report"

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Paleta (hex) compartilhada por Excel e PDF, para um visual consistente.
const HEX = { dark: "1F2937", accent: "2563EB", white: "FFFFFF", zebra: "F5F7FA", gray: "6B7280", line: "E5E7EB" }
const RGB = { dark: [31, 41, 55], accent: [37, 99, 235], zebra: [245, 247, 250], gray: [107, 114, 128], line: [229, 231, 235] }

// Uma seção vira "cabeçalho + tabela" de forma uniforme (kv/list/text também).
function sectionToTable(s: ReportSection): { columns: string[] | null; rows: (string | number)[][] } {
  if (s.kind === "table") return { columns: s.columns, rows: s.rows }
  if (s.kind === "keyvalue") return { columns: null, rows: s.pairs.map(([k, v]) => [k, v]) }
  if (s.kind === "list")
    return { columns: ["Respostas"], rows: s.items.length ? s.items.map((i) => [i]) : [["(sem respostas)"]] }
  return { columns: null, rows: [[s.text]] }
}

export function ExportButton({
  report,
  filename,
  size = "sm",
  variant = "outline",
}: {
  report: Report
  filename: string
  size?: "sm" | "default"
  variant?: "outline" | "ghost" | "default"
}) {
  const [busy, setBusy] = useState<null | "md" | "xlsx" | "pdf">(null)

  function exportMd() {
    const md = reportToMarkdown(report)
    triggerDownload(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${filename}.md`)
  }

  // ─────────────── EXCEL (.xlsx) ───────────────
  // Uma aba por seção, com cabeçalho em negrito/fundo escuro, bordas, zebra,
  // largura de coluna automática, quebra de texto e congelar/filtrar o cabeçalho.
  async function exportXlsx() {
    setBusy("xlsx")
    try {
      const XLSX = await import("xlsx-js-style")

      const border = { style: "thin", color: { rgb: HEX.line } }
      const allBorders = { top: border, bottom: border, left: border, right: border }
      const titleStyle = { font: { bold: true, sz: 15, color: { rgb: HEX.dark } } }
      const subtitleStyle = { font: { sz: 10, color: { rgb: HEX.gray } } }
      const headStyle = {
        font: { bold: true, color: { rgb: HEX.white } },
        fill: { patternType: "solid", fgColor: { rgb: HEX.dark } },
        alignment: { vertical: "center", wrapText: true },
        border: allBorders,
      }
      const cellStyle = { alignment: { vertical: "top", wrapText: true }, border: allBorders }
      const zebraStyle = { ...cellStyle, fill: { patternType: "solid", fgColor: { rgb: HEX.zebra } } }
      const keyStyle = { font: { bold: true }, alignment: { vertical: "top", wrapText: true }, border: allBorders }

      type Cell = string | number | { v: string | number; s?: object }
      const val = (c: Cell) => (typeof c === "object" ? c.v : c)

      const buildSheet = (matrix: Cell[][], filterCols: number | null): object => {
        const ws: Record<string, unknown> = {}
        let maxC = 0
        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix[r].length; c++) {
            const cell = matrix[r][c]
            if (cell === undefined || cell === null) continue
            const v = val(cell)
            const ref = XLSX.utils.encode_cell({ r, c })
            ws[ref] = { v, t: typeof v === "number" ? "n" : "s", s: typeof cell === "object" ? cell.s : undefined }
            if (c > maxC) maxC = c
          }
        }
        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, matrix.length - 1), c: maxC } })
        // largura por coluna (a partir do conteúdo), limitada
        const widths: { wch: number }[] = []
        for (let c = 0; c <= maxC; c++) {
          let max = 10
          for (const row of matrix) {
            const s = String(val(row[c] ?? "") ?? "")
            const longest = s.split("\n").reduce((a, l) => Math.max(a, l.length), 0)
            if (longest > max) max = longest
          }
          widths.push({ wch: Math.min(70, max + 2) })
        }
        ws["!cols"] = widths
        if (filterCols && filterCols > 0)
          ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: filterCols - 1 } }) }
        return ws
      }

      const wb = XLSX.utils.book_new()
      const usedNames = new Set<string>()
      const uniqueName = (h: string) => {
        const base = h.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Dados"
        let n = base
        let i = 2
        while (usedNames.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`
        usedNames.add(n.toLowerCase())
        return n
      }

      // Aba índice / capa
      const indexMatrix: Cell[][] = [
        [{ v: report.title, s: titleStyle }],
        [{ v: report.subtitle ?? "", s: subtitleStyle }],
        [""],
        [{ v: "Conteúdo", s: { font: { bold: true } } }],
        ...report.sections.map((s, i) => [`${i + 1}. ${s.heading}`]),
      ]
      XLSX.utils.book_append_sheet(wb, buildSheet(indexMatrix, null), uniqueName("Resumo"))

      for (const s of report.sections) {
        const { columns, rows } = sectionToTable(s)
        const matrix: Cell[][] = []
        if (columns) {
          matrix.push(columns.map((c) => ({ v: c, s: headStyle })))
          rows.forEach((row, ri) =>
            matrix.push(row.map((c) => ({ v: c, s: ri % 2 ? zebraStyle : cellStyle })))
          )
        } else {
          // keyvalue: coluna 0 (rótulo) em negrito
          rows.forEach((row) => matrix.push(row.map((c, ci) => ({ v: c, s: ci === 0 ? keyStyle : cellStyle }))))
        }
        XLSX.utils.book_append_sheet(wb, buildSheet(matrix, columns ? columns.length : null), uniqueName(s.heading))
      }

      XLSX.writeFile(wb, `${filename}.xlsx`)
    } catch {
      toast.error("Não foi possível gerar o Excel.")
    } finally {
      setBusy(null)
    }
  }

  // ─────────────── PDF ───────────────
  async function exportPdf() {
    setBusy("pdf")
    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default
      const doc = new jsPDF({ unit: "pt", format: "a4" })
      const M = 48
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()

      // Cabeçalho do documento
      doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(RGB.dark[0], RGB.dark[1], RGB.dark[2])
      const titleLines = doc.splitTextToSize(report.title, W - M * 2)
      doc.text(titleLines, M, M + 6)
      let y = M + 6 + titleLines.length * 20
      if (report.subtitle) {
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(RGB.gray[0], RGB.gray[1], RGB.gray[2])
        doc.text(report.subtitle, M, y)
        y += 14
      }
      doc.setDrawColor(RGB.accent[0], RGB.accent[1], RGB.accent[2]).setLineWidth(1.5)
      doc.line(M, y, W - M, y)
      y += 22

      for (const s of report.sections) {
        const { columns, rows } = sectionToTable(s)
        // cabeçalho da seção: mede a altura real (evita sobrepor a tabela)
        doc.setFont("helvetica", "bold").setFontSize(12)
        const headLines = doc.splitTextToSize(s.heading, W - M * 2)
        const headH = headLines.length * 15
        // mantém o cabeçalho junto de pelo menos parte da tabela
        if (y + headH + 60 > H - M) {
          doc.addPage()
          y = M + 10
        }
        doc.setTextColor(RGB.accent[0], RGB.accent[1], RGB.accent[2])
        doc.text(headLines, M, y + 11)
        y += headH + 8

        autoTable(doc, {
          head: columns ? [columns] : undefined,
          body: rows.map((r) => r.map((c) => String(c))),
          startY: y,
          margin: { left: M, right: M, top: M, bottom: 46 },
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 5,
            overflow: "linebreak",
            valign: "top",
            lineColor: RGB.line as [number, number, number],
            lineWidth: 0.5,
            textColor: [40, 40, 40],
          },
          headStyles: { fillColor: RGB.dark as [number, number, number], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: RGB.zebra as [number, number, number] },
          columnStyles: columns ? undefined : { 0: { fontStyle: "bold", cellWidth: 190 } },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22
      }

      // Rodapé com paginação (feito no fim, com o total de páginas certo)
      const total = doc.getNumberOfPages()
      for (let p = 1; p <= total; p++) {
        doc.setPage(p)
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(RGB.gray[0], RGB.gray[1], RGB.gray[2])
        doc.text(report.title.slice(0, 70), M, H - 22)
        doc.text(`Página ${p} de ${total}`, W - M, H - 22, { align: "right" })
      }

      doc.save(`${filename}.pdf`)
    } catch {
      toast.error("Não foi possível gerar o PDF.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!!busy}
        className={cn(buttonVariants({ variant, size }), busy && "opacity-70 pointer-events-none")}
      >
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
        Exportar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={exportXlsx}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf}>
          <FileType2 className="h-4 w-4 mr-2 text-red-500" />
          PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportMd}>
          <FileText className="h-4 w-4 mr-2 text-on-surface-variant" />
          Markdown (.md)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
