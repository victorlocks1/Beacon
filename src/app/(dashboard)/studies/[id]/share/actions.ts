"use server"
import crypto from "node:crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}

async function ownStudy(studyId: string, userId: string) {
  const study = await prisma.study.findUnique({
    where: { id: studyId, ownerId: userId },
    select: { id: true, shareCode: true },
  })
  if (!study) throw new Error("Estudo não encontrado")
  return study
}

// Garante que existe um shareCode (gera na primeira vez). Retorna o code.
export async function enableShareAction(studyId: string): Promise<{ code: string }> {
  const userId = await requireUserId()
  const study = await ownStudy(studyId, userId)
  if (study.shareCode) return { code: study.shareCode }
  const code = crypto.randomBytes(9).toString("base64url")
  await prisma.study.update({ where: { id: studyId }, data: { shareCode: code } })
  revalidatePath(`/studies/${studyId}`)
  return { code }
}

export async function addMemberByEmailAction(
  studyId: string,
  email: string
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const userId = await requireUserId()
  await ownStudy(studyId, userId)
  const clean = email.trim().toLowerCase()
  if (!clean) return { ok: false, error: "Informe um e-mail." }

  const user = await prisma.user.findUnique({ where: { email: clean }, select: { id: true, name: true, email: true } })
  if (!user) {
    return { ok: false, error: "Nenhuma conta com esse e-mail. Peça para a pessoa criar conta primeiro." }
  }
  const owner = await prisma.study.findUnique({ where: { id: studyId }, select: { ownerId: true } })
  if (owner?.ownerId === user.id) return { ok: false, error: "Essa pessoa é a dona do estudo." }

  await prisma.studyMember.upsert({
    where: { studyId_userId: { studyId, userId: user.id } },
    create: { studyId, userId: user.id },
    update: {},
  })
  revalidatePath(`/studies/${studyId}`)
  return { ok: true, name: user.name ?? user.email }
}

export async function removeMemberAction(studyId: string, memberUserId: string) {
  const userId = await requireUserId()
  await ownStudy(studyId, userId)
  await prisma.studyMember.deleteMany({ where: { studyId, userId: memberUserId } })
  revalidatePath(`/studies/${studyId}`)
}

// Entrar num estudo via link/código (usuário logado vira membro).
export async function joinStudyAction(code: string) {
  const userId = await requireUserId()
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
