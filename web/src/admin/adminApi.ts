import type {
  AdminAuditEntry,
  AdminOverviewData,
  AdminSearchResult,
  AdminUserDetailData,
  AdminUserFilter,
  AdminUserSummary,
  DailyPoint,
  RelayStats,
} from './adminTypes'
import { buildAuthRedirect } from '../cloud/authCallback'
import { getClient } from '../cloud/client'

/** RPC 返回结构不符合预期时抛出，避免把 undefined 渲染进页面 */
export class AdminDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminDataError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function rawText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function count(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

function items(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function parseUserSummary(value: unknown): AdminUserSummary | null {
  if (!isRecord(value)) return null
  const id = text(value.id)
  if (!id) return null
  return {
    id,
    email: rawText(value.email),
    createdAt: text(value.createdAt),
    lastSignInAt: text(value.lastSignInAt),
    bannedUntil: text(value.bannedUntil),
    isAdmin: value.isAdmin === true,
    resumeCount: count(value.resumeCount),
    lastResumeUpdate: text(value.lastResumeUpdate),
  }
}

function parseUsers(value: unknown): AdminUserSummary[] {
  return items(value)
    .map(parseUserSummary)
    .filter((u): u is AdminUserSummary => u !== null)
}

function parseDaily(value: unknown): DailyPoint[] {
  return items(value)
    .map((p): DailyPoint | null => {
      if (!isRecord(p)) return null
      const date = text(p.date)
      return date ? { date, count: count(p.count) } : null
    })
    .filter((p): p is DailyPoint => p !== null)
}

export function parseOverview(raw: unknown): AdminOverviewData {
  if (!isRecord(raw)) throw new AdminDataError('总览数据格式不正确')
  const { users, resumes } = raw
  if (!isRecord(users) || !isRecord(resumes)) throw new AdminDataError('总览指标缺失')
  const daily = isRecord(raw.daily) ? raw.daily : {}
  const attention = isRecord(raw.attention) ? raw.attention : {}
  return {
    users: { total: count(users.total), new7d: count(users.new7d), active7d: count(users.active7d) },
    resumes: {
      total: count(resumes.total),
      new7d: count(resumes.new7d),
      updated7d: count(resumes.updated7d),
      usersWithResume: count(resumes.usersWithResume),
    },
    attention: {
      banned: count(attention.banned),
      noResume7d: count(attention.noResume7d),
      inactive7d: count(attention.inactive7d),
    },
    daily: { users: parseDaily(daily.users), resumes: parseDaily(daily.resumes) },
    recentUsers: parseUsers(raw.recentUsers),
    activeUsers: parseUsers(raw.activeUsers),
  }
}

export function parseSearch(raw: unknown): AdminSearchResult {
  if (!isRecord(raw)) throw new AdminDataError('用户列表格式不正确')
  return { total: count(raw.total), users: parseUsers(raw.users) }
}

export function parseDetail(raw: unknown): AdminUserDetailData {
  if (!isRecord(raw) || !isRecord(raw.user)) throw new AdminDataError('用户详情格式不正确')
  const u = raw.user
  const profile = isRecord(raw.profile) && typeof raw.profile.displayName === 'string'
    ? { displayName: raw.profile.displayName }
    : null
  return {
    user: {
      id: rawText(u.id),
      email: rawText(u.email),
      createdAt: text(u.createdAt),
      emailConfirmedAt: text(u.emailConfirmedAt),
      lastSignInAt: text(u.lastSignInAt),
      bannedUntil: text(u.bannedUntil),
      isAdmin: u.isAdmin === true,
    },
    profile,
    resumes: items(raw.resumes)
      .map((r) => {
        if (!isRecord(r)) return null
        const id = text(r.id)
        return id
          ? {
              id,
              name: rawText(r.name) || '未命名简历',
              createdAt: text(r.createdAt),
              updatedAt: text(r.updatedAt),
              bytes: count(r.bytes),
            }
          : null
      })
      .filter((r): r is AdminUserDetailData['resumes'][number] => r !== null),
    storage: items(raw.storage)
      .map((s) => {
        if (!isRecord(s)) return null
        const bucket = text(s.bucket)
        return bucket ? { bucket, objects: count(s.objects), bytes: count(s.bytes) } : null
      })
      .filter((s): s is AdminUserDetailData['storage'][number] => s !== null),
  }
}

export function parseAudit(raw: unknown): AdminAuditEntry[] {
  return items(raw)
    .map((a): AdminAuditEntry | null => {
      if (!isRecord(a)) return null
      const id = count(a.id)
      if (!id) return null
      return {
        id,
        actorEmail: rawText(a.actorEmail),
        action: rawText(a.action),
        targetType: rawText(a.targetType),
        targetId: rawText(a.targetId),
        detail: isRecord(a.detail) ? a.detail : {},
        createdAt: rawText(a.createdAt),
      }
    })
    .filter((a): a is AdminAuditEntry => a !== null)
}

export function parseRelayStats(raw: unknown): RelayStats | null {
  if (!isRecord(raw)) return null
  const { active, expiring7d } = raw
  if (typeof active !== 'number' || !Number.isFinite(active) || active < 0) return null
  if (typeof expiring7d !== 'number' || !Number.isFinite(expiring7d) || expiring7d < 0) return null
  return { active, expiring7d, checkedAt: rawText(raw.checkedAt) }
}

export function mapAdminError(e: unknown): string {
  if (typeof e !== 'object' || e === null) return '操作失败，请稍后重试'
  const { code, message, name, status } = e as {
    code?: unknown
    message?: unknown
    name?: unknown
    status?: unknown
  }
  const msg = typeof message === 'string' ? message : ''

  if (code === '42501') return '当前账号没有管理权限'
  if (code === 'P0002') return '用户不存在或已注销'
  if (code === '22023') {
    if (/yourself/i.test(msg)) return '不能禁用当前登录账号'
    if (/admin/i.test(msg)) return '不能对管理员执行此操作'
    return '该操作不被允许'
  }
  if (code === 'PGRST301' || status === 401) return '登录已过期，请重新登录'
  if (name === 'AuthRetryableFetchError' || e instanceof TypeError || status === 0) {
    return '网络异常，请稍后重试'
  }
  return '操作失败，请稍后重试'
}

export function pageCount(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

export function clampPage(page: number, total: number, pageSize: number): number {
  const max = pageCount(total, pageSize)
  const current = Number.isFinite(page) ? Math.floor(page) : 1
  return Math.min(Math.max(1, current), max)
}

type RpcCaller = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

async function callRpc(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const client = (await getClient()) as unknown as RpcCaller
  const { data, error } = await client.rpc(fn, args)
  if (error) throw error
  return data
}

export async function adminOverview(): Promise<AdminOverviewData> {
  return parseOverview(await callRpc('admin_overview'))
}

export async function adminSearchUsers(
  query: string,
  page: number,
  pageSize = 20,
  filter: AdminUserFilter = 'all',
): Promise<AdminSearchResult> {
  const limit = Math.max(1, Math.min(100, Math.floor(pageSize) || 20))
  const offset = (Math.max(1, Math.floor(page) || 1) - 1) * limit
  return parseSearch(
    await callRpc('admin_search_users', {
      p_query: query.trim(),
      p_limit: limit,
      p_offset: offset,
      p_filter: filter,
    }),
  )
}

export async function adminUserDetail(userId: string): Promise<AdminUserDetailData> {
  return parseDetail(await callRpc('admin_user_detail', { p_user_id: userId }))
}

export async function adminRecentAudit(limit = 20): Promise<AdminAuditEntry[]> {
  return parseAudit(await callRpc('admin_recent_audit', { p_limit: limit }))
}

export async function adminSetBan(userId: string, banned: boolean): Promise<{ banned: boolean; bannedUntil: string | null }> {
  const raw = await callRpc('admin_set_ban', { p_user_id: userId, p_banned: banned })
  const data = isRecord(raw) ? raw : {}
  return { banned: data.banned === true, bannedUntil: text(data.bannedUntil) }
}

export async function adminLogAction(
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await callRpc('admin_log_action', {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_detail: detail,
  })
}

/** 先落审计再发信：审计失败则中止，确保每次对外动作都有记录 */
export async function adminSendPasswordReset(user: { id: string; email: string }): Promise<void> {
  if (!user.email) throw new Error('该账号没有邮箱')
  await adminLogAction('user.reset_password', 'user', user.id, { email: user.email })
  const client = await getClient()
  const { error } = await client.auth.resetPasswordForEmail(user.email, {
    redirectTo: buildAuthRedirect('recovery', import.meta.env.BASE_URL, location.href),
  })
  if (error) throw error
}

export async function fetchRelayStats(token: string, fetcher: typeof fetch = fetch): Promise<RelayStats | null> {
  if (!token) return null
  try {
    const res = await fetcher('/api/admin/relay-stats', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return parseRelayStats(await res.json())
  } catch {
    return null
  }
}
