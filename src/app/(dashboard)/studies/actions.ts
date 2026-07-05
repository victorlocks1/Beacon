"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { removeStorageByUrls } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

// Coleta as URLs de imagens (telas + tiras de scroll) sob um filtro de tela,
// para limpar o Storage antes do cascade apagar as linhas.
async function collectScreenImageUrls(where: {
  prototype: { studyId?: string; study?: { projectId: string } }
}) {
  const screens = await prisma.screen.findMany({
    where,
    select: { imageUrl: true, scrollRegions: { select: { imageUrl: true } } },
  })
  return [
    ...screens.map((s) => s.imageUrl),
    ...screens.flatMap((s) => s.scrollRegions.map((r) => r.imageUrl)),
  ]
}

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

  // valida posse antes de mexer no storage
  const owned = await prisma.study.findUnique({
    where: { id: studyId, ownerId: session.user.id },
    select: { id: true },
  })
  if (!owned) redirect("/projects")

  // limpa o storage antes do cascade apagar as telas
  await removeStorageByUrls(await collectScreenImageUrls({ prototype: { studyId } }))

  const study = await prisma.study.delete({
    where: { id: studyId, ownerId: session.user.id },
    select: { projectId: true },
  })

  revalidatePath(`/projects/${study.projectId}`)
}
