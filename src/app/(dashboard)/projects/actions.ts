"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}

export async function createProjectAction(formData: FormData) {
  const ownerId = await requireUserId()
  const name = (formData.get("name") as string)?.trim()
  if (!name) return

  const project = await prisma.project.create({ data: { ownerId, name } })
  revalidatePath("/projects")
  redirect(`/projects/${project.id}`)
}

export async function renameProjectAction(projectId: string, formData: FormData) {
  const ownerId = await requireUserId()
  const name = (formData.get("name") as string)?.trim()
  if (!name) return

  await prisma.project.update({
    where: { id: projectId, ownerId },
    data: { name },
  })
  revalidatePath("/projects")
  revalidatePath(`/projects/${projectId}`)
}

export async function archiveProjectAction(projectId: string, archived: boolean) {
  const ownerId = await requireUserId()
  await prisma.project.update({
    where: { id: projectId, ownerId },
    data: { archived },
  })
  revalidatePath("/projects")
}

export async function deleteProjectAction(projectId: string) {
  const ownerId = await requireUserId()
  // Cascade apaga os estudos do projeto (e tudo abaixo deles).
  await prisma.project.delete({ where: { id: projectId, ownerId } })
  revalidatePath("/projects")
}
