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

// nome de aba do Excel: <=31 chars, sem caracteres proibidos, único
function sheetName(heading: string, used: Set<string>): string {
  let base = heading.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Dados"
  let name = base
  let i = 2
  while (used.has(name.toLowerCase())) {
    name = `${base.slice(0, 26)} ${i++}`
  }
  used.add(name.toLowerCase())
  return name
}

function sectionToAoa(s: ReportSection): (string | number)[][] {
  if (s.kind === "keyvalue") return s.pairs.map(([k, v]) => [k, v])
  if (s.kind === "table") return [s.columns, ...s.rows]
  if (s.kind === "list") return s.items.length ? s.items.map((i) => [i]) : [["(sem respostas)"]]
  return [[s.text]]
}

export function ExportButton({
  report,
  filename,
  size = "sm",
  variant = "outline",
}: {
  report: Report
  filename: string // sem extensão
  size?: "sm" | "default"
  variant?: "outline" | "ghost" | "default"
}) {
  const [busy, setBusy] = useState<null | "md" | "xlsx" | "pdf">(null)

  function exportMd() {
    const md = reportToMarkdown(report)
    triggerDownload(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${filename}.md`)
  }

  async function exportXlsx() {
    setBusy("xlsx")
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()
      const used = new Set<string>()
      // 1ª aba: capa/índice
      const capa = XLSX.utils.aoa_to_sheet([[report.title], report.subtitle ? [report.subtitle] : [""]])
      XLSX.utils.book_append_sheet(wb, capa, sheetName("Resumo", used))
      for (const s of report.sections) {
        const ws = XLSX.utils.aoa_to_sheet(sectionToAoa(s))
        XLSX.utils.book_append_sheet(wb, ws, sheetName(s.heading, used))
      }
      XLSX.writeFile(wb, `${filename}.xlsx`)
    } catch {
      toast.error("Não foi possível gerar o Excel.")
    } finally {
      setBusy(null)
    }
  }

  async function exportPdf() {
    setBusy("pdf")
    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default
      const doc = new jsPDF({ unit: "pt", format: "a4" })
      const M = 40
      const W = doc.internal.pageSize.getWidth()
      let y = M

      doc.setFont("helvetica", "bold").setFontSize(16)
      doc.text(report.title, M, y, { maxWidth: W - M * 2 })
      y += 22
      if (report.subtitle) {
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120)
        doc.text(report.subtitle, M, y, { maxWidth: W - M * 2 })
        doc.setTextColor(0)
        y += 18
      }

      const ensure = (need: number) => {
        if (y + need > doc.internal.pageSize.getHeight() - M) {
          doc.addPage()
          y = M
        }
      }

      for (const s of report.sections) {
        ensure(40)
        doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(0)
        doc.text(s.heading, M, y, { maxWidth: W - M * 2 })
        y += 8

        if (s.kind === "table") {
          autoTable(doc, {
            head: [s.columns],
            body: s.rows.map((r) => r.map((c) => String(c))),
            startY: y + 6,
            margin: { left: M, right: M },
            styles: { fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [30, 30, 30] },
          })
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16
        } else if (s.kind === "keyvalue") {
          autoTable(doc, {
            body: s.pairs.map(([k, v]) => [k, v]),
            startY: y + 6,
            margin: { left: M, right: M },
            styles: { fontSize: 9, cellPadding: 4 },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 180 } },
          })
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16
        } else if (s.kind === "list") {
          doc.setFont("helvetica", "normal").setFontSize(9)
          const items = s.items.length ? s.items : ["(sem respostas)"]
          for (const it of items) {
            const lines = doc.splitTextToSize(`• ${it}`, W - M * 2)
            ensure(lines.length * 12 + 4)
            doc.text(lines, M, y + 10)
            y += lines.length * 12 + 4
          }
          y += 10
        } else {
          doc.setFont("helvetica", "normal").setFontSize(9)
          const lines = doc.splitTextToSize(s.text, W - M * 2)
          ensure(lines.length * 12)
          doc.text(lines, M, y + 10)
          y += lines.length * 12 + 12
        }
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
