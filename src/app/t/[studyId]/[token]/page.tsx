import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { type Lang } from "@/lib/i18n"
import { TesterRun, TesterThankYou, testerStudyInclude } from "@/components/test/tester-flow"

export default async function TestRunPage({
  params,
}: {
  params: Promise<{ studyId: string; token: string }>
}) {
  const { studyId, token } = await params

  const testSession = await prisma.session.findUnique({
    where: { token },
    include: { study: { include: testerStudyInclude } },
  })

  if (!testSession || testSession.studyId !== studyId) notFound()

  // Sessão já finalizada → agradecimento
  if (testSession.finishedAt) {
    return (
      <TesterThankYou
        lang={(testSession.study.language ?? "pt") as Lang}
        title={testSession.study.thanksTitle}
        message={testSession.study.thanksMessage}
      />
    )
  }

  return <TesterRun study={testSession.study} token={token} />
}
