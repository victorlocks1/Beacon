"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createStudyAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const title = (formData.get("title") as string)?.trim()
  const projectId = (formData.get("projectId") as string)?.trim()
  const deviceType = (formData.get("deviceType") as string) ?? "desktop"
  const language = (formData.get("language") as string) ?? "pt"
  if (!title || !projectId) return

  // O projeto precisa ser do usuário logado
  const project = await prisma.project.findUnique({
    where: { id: projectId, ownerId: session.user.id },
    select: { id: true },
  })
  if (!project) redirect("/projects")

  const study = await prisma.study.create({
    data: {
      ownerId: session.user.id,
      projectId: project.id,
      title,
      deviceType: deviceType as "desktop" | "tablet" | "mobile",
      language: (language === "es" ? "es" : "pt") as "pt" | "es",
    },
  })

  revalidatePath(`/projects/${project.id}`)
  redirect(`/studies/${study.id}`)
}

export async function deleteStudyAction(studyId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const study = await prisma.study.delete({
    where: { id: studyId, ownerId: session.user.id },
    select: { projectId: true },
  })

  revalidatePath(`/projects/${study.projectId}`)
}
