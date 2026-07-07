"use client"
import { Button } from "@/components/ui/button"
import { Info, ArrowRight } from "lucide-react"
import { tt, type Lang } from "@/lib/i18n"

// Tela "Como funciona": exibida depois das boas-vindas e antes das tarefas.
// Texto livre definido pelo criador; botão avança para o fluxo.
export function HowItWorksScreen({
  text,
  lang,
  onContinue,
}: {
  text: string
  lang: Lang
  onContinue: () => void
}) {
  const s = tt(lang)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md rounded-[28px] bg-surface-container-low border border-outline-variant p-10 space-y-8">
        <div className="space-y-3 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary mb-1">
            <Info className="h-7 w-7" />
          </div>
          <h1 className="text-headline-small text-on-surface">{s.howItWorksTitle}</h1>
        </div>
        <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">{text}</p>
        <Button onClick={onContinue} className="w-full h-12" size="lg">
          {s.continue}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
