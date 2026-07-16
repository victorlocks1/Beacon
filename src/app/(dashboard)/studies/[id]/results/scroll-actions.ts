"use server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { extractCountedClicks, type RawFigmaEvent } from "@/lib/figma-clicks"
import type { ScrollFrameGeom } from "@/lib/figma"

export type StripPoint = { x: number; y: number; handled: boolean }
export type ScrollStrip = {
  figmaId: string
  axis: "horizontal" | "vertical" | "both"
  isPage: boolean // true = scroll da PÁGINA inteira (vira o heatmap principal)
  contentW: number
  contentH: number
  pieces: { url: string; x: number; y: number; w: number; h: number }[]
  points: StripPoint[]
}

// Calcula, para uma TELA, as tiras roláveis (carrossel) com conteúdo escondido e o
// heatmap desenrolado de cada uma — posição do clique = viewport + offset de scroll,
// normalizada pelo tamanho do conteúdo. Lê o log cru (FigmaEventLog) sob demanda.
export async function getScrollStrips(
  studyId: string,
  missionId: string,
  screenId: string
): Promise<{ ok: true; strips: ScrollStrip[] } | { ok: false; error: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { ok: false, error: "unauthorized" }

    // a tela precisa pertencer a um estudo do usuário
    const screen = await prisma.screen.findFirst({
      where: { id: screenId, prototype: { study: { id: studyId, ownerId: session.user.id } } },
      select: { figmaNodeId: true, scrollFrames: true },
    })
    if (!screen?.figmaNodeId) return { ok: false, error: "screen_not_found" }

    const frames = (screen.scrollFrames as ScrollFrameGeom[] | null) ?? []
    // só as que têm tira exportada (pieces com url) e dimensão de conteúdo
    const strips = frames.filter(
      (f) => f.contentW && f.contentH && (f.pieces ?? []).some((p) => p.url)
    )
    if (!strips.length) return { ok: true, strips: [] }
    const stripById = new Map(strips.map((f) => [f.figmaId, f]))

    // telas do estudo (para detectar navegação no pareamento)
    const screenNodes = new Set(
      (
        await prisma.screen.findMany({
          where: { prototype: { studyId } },
          select: { figmaNodeId: true },
        })
      )
        .map((s) => s.figmaNodeId)
        .filter((n): n is string => !!n)
    )

    // eventos crus da missão, por sessão, em ordem de tempo
    const raw = await prisma.figmaEventLog.findMany({
      where: { missionId, session: { studyId } },
      select: { sessionId: true, type: true, data: true, clientTsMs: true, missionId: true },
      orderBy: { clientTsMs: "asc" },
    })
    const bySession = new Map<string, RawFigmaEvent[]>()
    for (const e of raw) {
      const arr = bySession.get(e.sessionId) ?? []
      arr.push({
        type: e.type,
        data: e.data as Record<string, unknown> | null,
        clientTsMs: Number(e.clientTsMs),
        missionId: e.missionId,
      })
      bySession.set(e.sessionId, arr)
    }

    const pointsByFrame = new Map<string, StripPoint[]>()
    for (const events of bySession.values()) {
      const clicks = extractCountedClicks(events, (id) => screenNodes.has(id))
      for (const cl of clicks) {
        if (cl.presentedNode !== screen.figmaNodeId || !cl.scrollFrameId) continue
        const strip = stripById.get(cl.scrollFrameId)
        if (!strip || !strip.contentW || !strip.contentH) continue
        const cx = (cl.vx + cl.ox) / strip.contentW
        const cy = (cl.vy + cl.oy) / strip.contentH
        if (cx < -0.02 || cx > 1.02 || cy < -0.02 || cy > 1.02) continue
        const arr = pointsByFrame.get(strip.figmaId) ?? []
        arr.push({ x: Math.max(0, Math.min(1, cx)), y: Math.max(0, Math.min(1, cy)), handled: cl.handled })
        pointsByFrame.set(strip.figmaId, arr)
      }
    }

    return {
      ok: true,
      strips: strips.map((f) => ({
        figmaId: f.figmaId,
        axis: f.axis ?? "horizontal",
        isPage: f.figmaId === screen.figmaNodeId,
        contentW: f.contentW!,
        contentH: f.contentH!,
        pieces: (f.pieces ?? [])
          .filter((p) => p.url)
          .map((p) => ({ url: p.url!, x: p.x, y: p.y, w: p.w, h: p.h })),
        points: pointsByFrame.get(f.figmaId) ?? [],
      })),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" }
  }
}
