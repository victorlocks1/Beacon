// Decide COMO um protótipo do Figma roda no Beacon, sem o usuário escolher:
//
//  • arquivo PÚBLICO ("qualquer pessoa com o link")  → protótipo AO VIVO (embed);
//  • arquivo restrito (login da empresa ou senha)    → RÉPLICA: as telas rodam
//    como imagens + hotspots dentro do Beacon, e o participante não precisa de
//    acesso nenhum ao Figma.
//
// A checagem usa o oEmbed público do Figma (sem token): ele só responde 200
// quando um visitante anônimo consegue abrir o arquivo — exatamente a situação
// do participante. Verificado: público → 200; login exigido → 404; senha → 404.
import { FIGMA_EMBED_CLIENT_ID } from "@/lib/figma-embed"

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; isPublic: boolean }>()

/** true/false = resposta do Figma; null = não deu para saber (rede/erro). */
export async function figmaIsPublic(fileKey: string): Promise<boolean | null> {
  const hit = cache.get(fileKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.isPublic
  try {
    const target = encodeURIComponent(`https://www.figma.com/proto/${fileKey}/beacon`)
    const res = await fetch(`https://www.figma.com/api/oembed?url=${target}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    // 200 = público; 403/404 = restrito. Qualquer outra coisa (429, 5xx) = não sei.
    if (res.status !== 200 && res.status !== 403 && res.status !== 404) return null
    const isPublic = res.status === 200
    cache.set(fileKey, { at: Date.now(), isPublic })
    return isPublic
  } catch {
    return null
  }
}

/**
 * O teste deste protótipo roda AO VIVO no embed do Figma? Só quando é um
 * protótipo do Figma, o embed está configurado e o arquivo abre para qualquer
 * pessoa. Sem conseguir consultar o Figma, assume ao vivo (comportamento de
 * sempre) — o runner avisa se o protótipo não carregar.
 */
export async function runsLiveFigma(
  proto: { source: string; figmaFileKey: string | null } | null | undefined
): Promise<boolean> {
  if (proto?.source !== "figma" || !proto.figmaFileKey || !FIGMA_EMBED_CLIENT_ID) return false
  return (await figmaIsPublic(proto.figmaFileKey)) !== false
}
