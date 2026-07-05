import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return _client
}

// Proxy lazy: o client só é criado no primeiro acesso (em runtime),
// nunca durante o build — evita "supabaseUrl is required" no deploy.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})

export function getPublicUrl(path: string) {
  const { data } = supabase.storage.from("screens").getPublicUrl(path)
  return data.publicUrl
}

// Deriva a chave do objeto no bucket a partir da URL pública salva no banco.
export function storageKeyFromUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  try {
    const path = new URL(imageUrl).pathname.split("/object/public/screens/")[1]
    return path ? decodeURIComponent(path) : null
  } catch {
    return null
  }
}

// Remove objetos do Storage a partir das URLs públicas. Best-effort: nunca
// lança — limpeza de storage não deve abortar a exclusão no banco.
export async function removeStorageByUrls(urls: (string | null | undefined)[]) {
  const keys = urls
    .map(storageKeyFromUrl)
    .filter((k): k is string => !!k)
  if (!keys.length) return
  for (let i = 0; i < keys.length; i += 1000) {
    // a API aceita até 1000 paths por chamada
    try {
      await supabase.storage.from("screens").remove(keys.slice(i, i + 1000))
    } catch {
      /* ignora — melhor um órfão do que quebrar a operação */
    }
  }
}
