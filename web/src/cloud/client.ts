const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const REF = SUPABASE_URL.match(/\/\/([^.]+)\./)?.[1] ?? ''

export function cloudConfigured(): boolean {
  return SUPABASE_URL !== '' && SUPABASE_KEY !== ''
}

export function hasStoredSession(): boolean {
  if (!REF) return false
  try { return window.localStorage.getItem(`sb-${REF}-auth-token`) !== null } catch { return false }
}

type SupabaseClient = import('@supabase/supabase-js').SupabaseClient
let instance: SupabaseClient | null = null

export async function getClient(): Promise<SupabaseClient> {
  if (instance) return instance
  const { createClient } = await import('@supabase/supabase-js')
  instance = createClient(SUPABASE_URL, SUPABASE_KEY)
  return instance
}
