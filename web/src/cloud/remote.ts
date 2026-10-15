import { normalizeResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import type { CloudRemote } from './sync'

type SupabaseClient = import('@supabase/supabase-js').SupabaseClient

export function createRemote(client: SupabaseClient, userId: string): CloudRemote {
  return {
    async fetch() {
      const { data, error } = await client
        .from('resumes')
        .select('data, updated_at')
        .eq('user_id', userId)
        .eq('name', '我的简历')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { data: data.data, updatedAt: data.updated_at as string }
    },
    async push(resume: Resume) {
      const plain = JSON.parse(JSON.stringify(normalizeResume(resume)))
      const { data, error } = await client
        .from('resumes')
        .upsert({ user_id: userId, name: '我的简历', data: plain }, { onConflict: 'user_id,name' })
        .select('updated_at')
        .single()
      if (error) throw error
      return data.updated_at as string
    },
  }
}
