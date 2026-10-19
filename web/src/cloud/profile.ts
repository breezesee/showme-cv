type SupabaseClient = import('@supabase/supabase-js').SupabaseClient

export const MAX_DISPLAY_NAME = 40

export interface UserProfile {
  displayName: string
  updatedAt: string
}

/** 昵称清洗：去首尾空白、折叠连续空白、限制长度 */
export function cleanDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_DISPLAY_NAME).trim()
}

/** 默认昵称：邮箱 @ 前部分；没有可用字符时用「ShowMe 用户」 */
export function defaultDisplayName(email: string): string {
  const local = email.trim().split('@')[0]?.trim() ?? ''
  return local || 'ShowMe 用户'
}

/** 头像首字：优先昵称，其次邮箱；用 Array.from 正确处理 emoji 等代理对 */
export function displayInitial(name: string, email = ''): string {
  const source = name.trim() || email.trim() || 'ShowMe'
  return (Array.from(source)[0] ?? 'S').toUpperCase()
}

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<UserProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('display_name, updated_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { displayName: String(data.display_name ?? '').trim(), updatedAt: data.updated_at as string }
}

export async function saveProfile(
  client: SupabaseClient,
  userId: string,
  rawName: string,
): Promise<UserProfile> {
  const displayName = cleanDisplayName(rawName)
  if (!displayName) throw new Error('昵称不能为空')
  const { data, error } = await client
    .from('profiles')
    .upsert({ id: userId, display_name: displayName }, { onConflict: 'id' })
    .select('display_name, updated_at')
    .single()
  if (error) throw error
  return { displayName: data.display_name as string, updatedAt: data.updated_at as string }
}
