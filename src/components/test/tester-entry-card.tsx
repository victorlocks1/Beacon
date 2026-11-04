import { ClipboardCheck, Info } from "lucide-react"
import { tt, type Lang } from "@/lib/i18n"

// Cartão de boas-vindas do teste (a primeira tela do participante). É o MESMO
// componente no link do testador e na revisão — muda só o botão: no testador ele
// cria a sessão; na revisão só avança, sem gravar nada.
export function TesterEntryCard({
  lang,
  welcomeTitle,
  welcomeMessage,
  howItWorks,
  startButton,
}: {
  lang: Lang
  welcomeTitle: string | null
  welcomeMessage: string | null
  howItWorks: string | null
  startButton: React.ReactNode
}) {
  const s = tt(lang)
  const how = howItWorks?.trim()
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div
        className={
          "w-full rounded-[28px] bg-surface-container-low border border-outline-variant p-8 md:p-10 " +
          (how ? "max-w-3xl grid md:grid-cols-2 gap-8 md:gap-10 items-start" : "max-w-md")
        }
      >
        {/* Boas-vindas (alinhado à esquerda) */}
        <div className="space-y-6 text-left">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <div className="space-y-3">
            <h1 className="text-headline-small text-on-surface">{welcomeTitle || s.welcomeTitle}</h1>
            <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">
              {welcomeMessage || s.welcomeIntro}
            </p>
          </div>
        </div>

        {/* Como funciona (à direita, separado) */}
        {how && (
          <div className="space-y-3 text-left md:border-l md:border-outline-variant md:pl-10">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Info className="h-5 w-5" />
            </div>
            <h2 className="text-title-large text-on-surface">{s.howItWorksTitle}</h2>
            <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">{how}</p>
          </div>
        )}

        {/* Botão no rodapé direito do card (abaixo das duas colunas) */}
        <div className={"flex justify-end " + (how ? "md:col-span-2" : "mt-8")}>{startButton}</div>
      </div>
    </div>
  )
}
