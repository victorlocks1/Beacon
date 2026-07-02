import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"

// Link de compartilhamento: o usuário logado vira membro do estudo e vai
// para a página de revisão.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const study = await prisma.study.findUnique({
    where: { shareCode: code },
    select: { id: true, ownerId: true },
  })
  if (!study) redirect("/projects")

  if (study.ownerId !== userId) {
    await prisma.studyMember.upsert({
      where: { studyId_userId: { studyId: study.id, userId } },
      create: { studyId: study.id, userId },
      update: {},
    })
  }
  redirect(`/studies/${study.id}/review`)
}
