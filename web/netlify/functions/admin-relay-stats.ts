/**
 * 管理台只读统计：短链中转库里当前有效 / 7 天内到期的记录数。
 * - 用管理员自己会话的 access token 校验身份，要求 app_metadata.role === 'admin'；
 * - 只使用 publishable key，不引入 service_role；
 * - Blobs 没有原生 TTL，过期时间在记录里（懒过期），所以逐条读取后按 exp 计数。
 */
import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { createClient } from '@supabase/supabase-js'

interface RelayRecord {
  v: string
  exp: number
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
const READ_BATCH = 20

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function bearerToken(req: Request): string {
  const raw = req.headers.get('authorization') ?? ''
  return raw.startsWith('Bearer ') ? raw.slice(7).trim() : ''
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' })
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(503, { error: 'not_configured' })

  const token = bearerToken(req)
  if (!token) return json(401, { error: 'unauthorized' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return json(401, { error: 'unauthorized' })
  if (user.app_metadata?.role !== 'admin') return json(403, { error: 'forbidden' })

  try {
    const now = Date.now()
    const horizon = now + SEVEN_DAYS
    let active = 0
    let expiring7d = 0
    const store = getStore('relay')

    for await (const page of store.list({ prefix: 'r:', paginate: true })) {
      for (let i = 0; i < page.blobs.length; i += READ_BATCH) {
        const keys = page.blobs.slice(i, i + READ_BATCH).map((blob) => blob.key)
        const records = await Promise.all(
          keys.map((key) => store.get(key, { type: 'json', consistency: 'strong' })),
        )
        for (const raw of records) {
          const record = raw as RelayRecord | null
          if (!record || typeof record.exp !== 'number' || record.exp <= now) continue
          active++
          if (record.exp <= horizon) expiring7d++
        }
      }
    }

    return json(200, { active, expiring7d, checkedAt: new Date().toISOString() })
  } catch {
    return json(503, { error: 'unavailable' })
  }
}

export const config: Config = {
  path: '/api/admin/relay-stats',
}
