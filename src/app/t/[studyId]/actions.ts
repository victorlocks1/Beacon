"use server"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export async function startSessionAction(studyId: string) {
  const study = await prisma.study.findUnique({ where: { id: studyId } })
  if (!study || study.status !== "live") {
    redirect(`/t/${studyId}`)
  }

  const h = await headers()
  const userAgent = h.get("user-agent") ?? null

  const newSession = await prisma.session.create({
    data: {
      studyId,
      userAgent,
      deviceType: study.deviceType,
    },
  })

  redirect(`/t/${studyId}/${newSession.token}`)
}
