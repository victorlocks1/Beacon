// ⚠️ TEMPORÁRIO — diagnóstico de conexão com o banco. Remover depois.
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const out: Record<string, unknown> = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    dbUrlHost: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? null,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  try {
    const count = await prisma.study.count()
    out.ok = true
    out.studyCount = count
  } catch (e) {
    const err = e as { message?: string; code?: string; name?: string }
    out.ok = false
    out.errorName = err.name
    out.errorCode = err.code
    out.errorMessage = err.message
  }
  return Response.json(out)
}
