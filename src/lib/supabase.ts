import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export function getPublicUrl(path: string) {
  const { data } = supabase.storage.from("screens").getPublicUrl(path)
  return data.publicUrl
}
