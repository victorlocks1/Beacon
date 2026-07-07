"use server"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export async function startSessionAction(studyId: string, live?: boolean) {
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

  // preserva o modo ao vivo através do redirect (link único de teste)
  redirect(`/t/${studyId}/${newSession.token}${live ? "?live=1" : ""}`)
}
