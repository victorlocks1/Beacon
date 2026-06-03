"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createStudyAction(formData: FormData) {
  const session = await auth()
  if (!session) redirect("/login")

  const title = (formData.get("title") as string)?.trim()
  const deviceType = (formData.get("deviceType") as string) ?? "desktop"
  if (!title) return

  const study = await prisma.study.create({
    data: {
      ownerId: session.user.id,
      title,
      deviceType: deviceType as "desktop" | "tablet" | "mobile",
    },
  })

  revalidatePath("/studies")
  redirect(`/studies/${study.id}`)
}

export async function deleteStudyAction(studyId: string) {
  const session = await auth()
  if (!session) redirect("/login")

  await prisma.study.delete({
    where: { id: studyId, ownerId: session.user.id },
  })

  revalidatePath("/studies")
}
