import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"

// Acesso de VISUALIZAÇÃO a um estudo: dono OU membro convidado.
// Redireciona se não estiver logado ou não tiver acesso.
export async function requireStudyView(studyId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const study = await prisma.study.findFirst({
    where: {
      id: studyId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true, ownerId: true, title: true },
  })
  if (!study) redirect("/projects")

  return { userId, isOwner: study.ownerId === userId, study }
}

// Verifica acesso sem redirecionar (para uso em actions).
export async function canAccessStudy(studyId: string, userId: string) {
  const study = await prisma.study.findFirst({
    where: {
      id: studyId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  })
  return !!study
}
