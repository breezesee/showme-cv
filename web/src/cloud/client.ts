import { avatarUrl } from '../model/avatar'
import { photoUrl } from '../model/photo'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const REF = SUPABASE_URL.match(/\/\/([^.]+)\./)?.[1] ?? ''

export function cloudConfigured(): boolean {
  return SUPABASE_URL !== '' && SUPABASE_KEY !== ''
}

/** 照片公开 URL：每次读取当前环境，便于测试替换部署地址 */
export function photoPublicUrl(path: string): string {
  return photoUrl(import.meta.env.VITE_SUPABASE_URL ?? '', path)
}

/** 头像公开 URL */
export function avatarPublicUrl(path: string): string {
  return avatarUrl(import.meta.env.VITE_SUPABASE_URL ?? '', path)
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
