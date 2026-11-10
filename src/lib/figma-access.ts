// Decide COMO um protótipo do Figma roda no Beacon, sem o usuário escolher:
//
//  • arquivo PÚBLICO ("qualquer pessoa com o link")  → protótipo AO VIVO (embed);
//  • arquivo restrito (login da empresa ou senha)    → RÉPLICA: as telas rodam
//    como imagens + hotspots dentro do Beacon, e o participante não precisa de
//    acesso nenhum ao Figma.
//
// A checagem abre o protótipo como visitante anônimo, sem token — a mesma
// situação do participante (ver checkPublicAccess).
import { FIGMA_EMBED_CLIENT_ID } from "@/lib/figma-embed"

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; isPublic: boolean }>()

/** true/false = resposta do Figma; null = não deu para saber (rede/erro). */
export async function figmaIsPublic(fileKey: string): Promise<boolean | null> {
  const hit = cache.get(fileKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.isPublic
  const isPublic = await checkPublicAccess(fileKey)
  if (isPublic !== null) cache.set(fileKey, { at: Date.now(), isPublic })
  return isPublic
}

// Abre o protótipo como um VISITANTE ANÔNIMO (exatamente o que o participante
// faz) e lê a resposta. Calibrado com arquivos reais:
//   livre          → 200, página do protótipo
//   exige login    → 403
//   exige senha    → 200, mas com o campo de senha (link_password_input)
// O oEmbed, usado antes, dava falso "bloqueado" para arquivos liberados só para
// ver o protótipo (sem acesso ao arquivo de design) — o caso mais comum.
async function checkPublicAccess(fileKey: string): Promise<boolean | null> {
  // atalho barato: oEmbed 200 já garante que é público. 404 NÃO garante que é
  // restrito (falso negativo em arquivos liberados só como protótipo).
  let oembed: boolean | null = null
  try {
    const target = encodeURIComponent(`https://www.figma.com/proto/${fileKey}/beacon`)
    const res = await fetch(`https://www.figma.com/api/oembed?url=${target}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    if (res.status === 200) return true
    if (res.status === 403 || res.status === 404) oembed = false
  } catch {
    /* segue para a checagem pela página */
  }
  const page = await checkPrototypePage(fileKey)
  // página ilegível (bloqueio/erro no caminho) → fica com a resposta do oEmbed
  return page ?? oembed
}

async function checkPrototypePage(fileKey: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://www.figma.com/proto/${fileKey}/beacon`, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        // a página só é servida completa para um navegador
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    })
    const html = await res.text()
    // Só conclui "restrito" com uma resposta que é do PRÓPRIO Figma (traz o
    // "page_type" da página dele). Um bloqueio anti-robô ou erro de rede no
    // caminho também pode dar 403 — aí não sabemos (null → segue ao vivo, e o
    // runner avisa se o protótipo não abrir).
    const isFigmaPage = html.includes('"page_type"')
    if (res.status === 401 || res.status === 403 || res.status === 404) return isFigmaPage ? false : null
    if (res.status !== 200) return null
    if (html.includes("link_password_input")) return false // pede senha
    return true
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
