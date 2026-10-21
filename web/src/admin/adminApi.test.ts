import { describe, expect, it } from 'vitest'
import {
  AdminDataError,
  clampPage,
  fetchRelayStats,
  mapAdminError,
  pageCount,
  parseAudit,
  parseDetail,
  parseOverview,
  parseRelayStats,
  parseSearch,
} from './adminApi'

const userSummary = {
  id: 'u-1',
  email: 'a@example.com',
  createdAt: '2026-10-20T00:00:00Z',
  lastSignInAt: '2026-10-21T04:00:00Z',
  bannedUntil: null,
  isAdmin: false,
  resumeCount: 2,
  lastResumeUpdate: '2026-10-21T05:00:00Z',
}

describe('mapAdminError', () => {
  it('数据库权限与业务码映射为可读提示', () => {
    expect(mapAdminError({ code: '42501', message: 'admin only' })).toBe('当前账号没有管理权限')
    expect(mapAdminError({ code: 'P0002', message: 'user not found' })).toBe('用户不存在或已注销')
    expect(mapAdminError({ code: '22023', message: 'cannot ban yourself' })).toBe('不能禁用当前登录账号')
    expect(mapAdminError({ code: '22023', message: 'cannot ban an admin' })).toBe('不能对管理员执行此操作')
    expect(mapAdminError({ code: '22023', message: 'invalid ban state' })).toBe('该操作不被允许')
  })

  it('登录过期与网络异常', () => {
    expect(mapAdminError({ code: 'PGRST301', message: 'JWT expired' })).toBe('登录已过期，请重新登录')
    expect(mapAdminError({ status: 401 })).toBe('登录已过期，请重新登录')
    expect(mapAdminError(new TypeError('Failed to fetch'))).toBe('网络异常，请稍后重试')
    expect(mapAdminError({ name: 'AuthRetryableFetchError' })).toBe('网络异常，请稍后重试')
  })

  it('未知错误兜底', () => {
    expect(mapAdminError({ code: 'XX000' })).toBe('操作失败，请稍后重试')
    expect(mapAdminError(null)).toBe('操作失败，请稍后重试')
    expect(mapAdminError('boom')).toBe('操作失败，请稍后重试')
  })
})

describe('parseOverview', () => {
  it('解析指标、14 天序列与最近用户', () => {
    const parsed = parseOverview({
      users: { total: 7, new7d: 3, active7d: 5 },
      resumes: { total: 4, new7d: 2, updated7d: 4, usersWithResume: 3 },
      attention: { banned: 1, noResume7d: 2, inactive7d: 3 },
      daily: {
        users: [{ date: '10-08', count: 0 }, { date: '10-09', count: 2 }],
        resumes: [{ date: '10-08', count: 1 }],
      },
      recentUsers: [
        { id: 'u-1', email: 'a@example.com', createdAt: '2026-10-20T00:00:00Z', lastSignInAt: null, resumeCount: 2 },
        { id: '', email: 'bad' },
      ],
      activeUsers: [
        {
          id: 'u-2',
          email: 'b@example.com',
          createdAt: '2026-10-01T00:00:00Z',
          lastSignInAt: '2026-10-21T03:00:00Z',
          bannedUntil: null,
          isAdmin: false,
          resumeCount: 1,
          lastResumeUpdate: '2026-10-21T04:00:00Z',
        },
      ],
    })
    expect(parsed.users).toEqual({ total: 7, new7d: 3, active7d: 5 })
    expect(parsed.resumes).toEqual({ total: 4, new7d: 2, updated7d: 4, usersWithResume: 3 })
    expect(parsed.attention).toEqual({ banned: 1, noResume7d: 2, inactive7d: 3 })
    expect(parsed.daily.users).toEqual([{ date: '10-08', count: 0 }, { date: '10-09', count: 2 }])
    expect(parsed.daily.resumes).toEqual([{ date: '10-08', count: 1 }])
    expect(parsed.recentUsers).toEqual([
      {
        id: 'u-1',
        email: 'a@example.com',
        createdAt: '2026-10-20T00:00:00Z',
        lastSignInAt: null,
        bannedUntil: null,
        isAdmin: false,
        resumeCount: 2,
        lastResumeUpdate: null,
      },
    ])
    expect(parsed.activeUsers).toEqual([
      {
        id: 'u-2',
        email: 'b@example.com',
        createdAt: '2026-10-01T00:00:00Z',
        lastSignInAt: '2026-10-21T03:00:00Z',
        bannedUntil: null,
        isAdmin: false,
        resumeCount: 1,
        lastResumeUpdate: '2026-10-21T04:00:00Z',
      },
    ])
  })

  it('缺省的可选部分回落为空数组', () => {
    const parsed = parseOverview({ users: {}, resumes: {} })
    expect(parsed.users).toEqual({ total: 0, new7d: 0, active7d: 0 })
    expect(parsed.resumes).toEqual({ total: 0, new7d: 0, updated7d: 0, usersWithResume: 0 })
    expect(parsed.attention).toEqual({ banned: 0, noResume7d: 0, inactive7d: 0 })
    expect(parsed.daily).toEqual({ users: [], resumes: [] })
    expect(parsed.recentUsers).toEqual([])
    expect(parsed.activeUsers).toEqual([])
  })

  it('结构非法时抛 AdminDataError', () => {
    expect(() => parseOverview(null)).toThrow(AdminDataError)
    expect(() => parseOverview([])).toThrow(AdminDataError)
    expect(() => parseOverview({ resumes: {} })).toThrow(AdminDataError)
    expect(() => parseOverview({ users: {}, resumes: 'x' })).toThrow(AdminDataError)
  })
})

describe('parseSearch', () => {
  it('解析总数与用户列表', () => {
    const parsed = parseSearch({ total: '7', users: [userSummary] })
    expect(parsed.total).toBe(7)
    expect(parsed.users).toEqual([userSummary])
  })

  it('非法条目被过滤，缺省值保持稳定', () => {
    const parsed = parseSearch({ total: 'x', users: [{ id: 'u-2', email: 'b@example.com' }, { id: '' }] })
    expect(parsed.total).toBe(0)
    expect(parsed.users).toEqual([
      {
        id: 'u-2',
        email: 'b@example.com',
        createdAt: null,
        lastSignInAt: null,
        bannedUntil: null,
        isAdmin: false,
        resumeCount: 0,
        lastResumeUpdate: null,
      },
    ])
  })

  it('根结构非法时抛错', () => {
    expect(() => parseSearch(null)).toThrow(AdminDataError)
    expect(() => parseSearch('x')).toThrow(AdminDataError)
  })
})

describe('parseDetail', () => {
  const raw = {
    user: {
      id: 'u-1',
      email: 'a@example.com',
      createdAt: '2026-10-20T00:00:00Z',
      emailConfirmedAt: null,
      lastSignInAt: '2026-10-21T04:00:00Z',
      bannedUntil: null,
      isAdmin: false,
    },
    profile: { displayName: '小明' },
    resumes: [
      {
        id: 'r-1',
        name: '我的简历',
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-21T05:00:00Z',
        bytes: '750',
        data: { secret: 'never render' },
      },
    ],
    storage: [{ bucket: 'avatars', objects: '2', bytes: '2048' }],
  }

  it('只保留元信息，绝不带出简历内容', () => {
    const parsed = parseDetail(raw)
    expect(parsed.user).toEqual(raw.user)
    expect(parsed.profile).toEqual({ displayName: '小明' })
    expect(parsed.resumes).toEqual([
      { id: 'r-1', name: '我的简历', createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-21T05:00:00Z', bytes: 750 },
    ])
    expect('data' in parsed.resumes[0]).toBe(false)
    expect(parsed.storage).toEqual([{ bucket: 'avatars', objects: 2, bytes: 2048 }])
  })

  it('缺省部分回落为空值', () => {
    const parsed = parseDetail({ user: { id: 'u-1', email: 'a@example.com' } })
    expect(parsed.profile).toBeNull()
    expect(parsed.resumes).toEqual([])
    expect(parsed.storage).toEqual([])
    expect(parsed.user.createdAt).toBeNull()
  })

  it('缺少用户或结构非法时抛错', () => {
    expect(() => parseDetail(null)).toThrow(AdminDataError)
    expect(() => parseDetail({ profile: null })).toThrow(AdminDataError)
  })
})

describe('parseAudit', () => {
  it('解析审计记录并过滤非法条目', () => {
    expect(
      parseAudit([
        {
          id: '12',
          actorEmail: 'admin@example.com',
          action: 'user.ban',
          targetType: 'user',
          targetId: 'u-1',
          detail: { email: 'a@example.com' },
          createdAt: '2026-10-21T06:00:00Z',
        },
        { id: null },
        null,
      ]),
    ).toEqual([
      {
        id: 12,
        actorEmail: 'admin@example.com',
        action: 'user.ban',
        targetType: 'user',
        targetId: 'u-1',
        detail: { email: 'a@example.com' },
        createdAt: '2026-10-21T06:00:00Z',
      },
    ])
  })

  it('非数组返回空列表', () => {
    expect(parseAudit(null)).toEqual([])
    expect(parseAudit({})).toEqual([])
  })
})

describe('parseRelayStats', () => {
  it('接受合法统计', () => {
    expect(parseRelayStats({ active: 3, expiring7d: 1, checkedAt: '2026-10-21T12:00:00Z' })).toEqual({
      active: 3,
      expiring7d: 1,
      checkedAt: '2026-10-21T12:00:00Z',
    })
  })

  it('缺失或非法返回 null', () => {
    expect(parseRelayStats(null)).toBeNull()
    expect(parseRelayStats({})).toBeNull()
    expect(parseRelayStats({ active: -1, expiring7d: 0 })).toBeNull()
    expect(parseRelayStats({ active: 1, expiring7d: '2' })).toBeNull()
  })
})

describe('fetchRelayStats', () => {
  it('携带管理员令牌并禁用缓存', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ active: 2, expiring7d: 1, checkedAt: '2026-10-21T12:00:00Z' }), { status: 200 })
    }) as typeof fetch

    const stats = await fetchRelayStats('token-1', fake)
    expect(stats).toEqual({ active: 2, expiring7d: 1, checkedAt: '2026-10-21T12:00:00Z' })
    expect(calls[0].url).toBe('/api/admin/relay-stats')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1')
    expect(calls[0].init?.cache).toBe('no-store')
  })

  it('未授权、网络失败与坏数据都返回 null', async () => {
    const unauthorized = (async () => new Response('no', { status: 401 })) as typeof fetch
    expect(await fetchRelayStats('token-1', unauthorized)).toBeNull()

    const failure = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await fetchRelayStats('token-1', failure)).toBeNull()

    const garbage = (async () => new Response('not json', { status: 200 })) as typeof fetch
    expect(await fetchRelayStats('token-1', garbage)).toBeNull()
  })

  it('没有令牌时不发请求', async () => {
    let called = false
    const fake = (async () => {
      called = true
      return new Response('{}')
    }) as typeof fetch
    expect(await fetchRelayStats('', fake)).toBeNull()
    expect(called).toBe(false)
  })
})

describe('分页', () => {
  it('pageCount 至少一页', () => {
    expect(pageCount(0, 20)).toBe(1)
    expect(pageCount(20, 20)).toBe(1)
    expect(pageCount(21, 20)).toBe(2)
    expect(pageCount(100, 0)).toBe(1)
  })

  it('clampPage 落在有效范围', () => {
    expect(clampPage(0, 21, 20)).toBe(1)
    expect(clampPage(5, 21, 20)).toBe(2)
    expect(clampPage(2, 0, 20)).toBe(1)
  })
})
