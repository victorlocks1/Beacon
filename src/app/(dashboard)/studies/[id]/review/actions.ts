"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { canAccessStudy } from "@/lib/access"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireAccess(studyId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id
  if (!(await canAccessStudy(studyId, userId))) throw new Error("Sem acesso")
  return userId
}

export async function addCommentAction(
  studyId: string,
  input: { screenId: string; xNorm: number; yNorm: number; body: string }
) {
  const userId = await requireAccess(studyId)
  const body = input.body?.trim()
  if (!body) return
  // A tela precisa ser deste estudo
  const screen = await prisma.screen.findFirst({
    where: { id: input.screenId, prototype: { studyId } },
    select: { id: true },
  })
  if (!screen) return
  await prisma.comment.create({
    data: {
      studyId,
      screenId: input.screenId,
      xNorm: Math.max(0, Math.min(1, input.xNorm)),
      yNorm: Math.max(0, Math.min(1, input.yNorm)),
      authorId: userId,
      body,
    },
  })
  revalidatePath(`/studies/${studyId}/review`)
}

export async function replyCommentAction(studyId: string, parentId: string, body: string) {
  const userId = await requireAccess(studyId)
  const text = body?.trim()
  if (!text) return
  const parent = await prisma.comment.findFirst({
    where: { id: parentId, studyId },
    select: { id: true },
  })
  if (!parent) return
  await prisma.comment.create({
    data: { studyId, parentId, authorId: userId, body: text },
  })
  revalidatePath(`/studies/${studyId}/review`)
}

export async function resolveCommentAction(studyId: string, commentId: string, resolved: boolean) {
  await requireAccess(studyId)
  await prisma.comment.updateMany({
    where: { id: commentId, studyId },
    data: { resolved },
  })
  revalidatePath(`/studies/${studyId}/review`)
}

export async function deleteCommentAction(studyId: string, commentId: string) {
  const userId = await requireAccess(studyId)
  // Autor do comentário OU dono do estudo pode excluir
  const study = await prisma.study.findUnique({ where: { id: studyId }, select: { ownerId: true } })
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, studyId },
    select: { authorId: true },
  })
  if (!comment) return
  if (comment.authorId !== userId && study?.ownerId !== userId) return
  await prisma.comment.delete({ where: { id: commentId } }) // cascateia respostas
  revalidatePath(`/studies/${studyId}/review`)
}
