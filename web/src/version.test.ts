import { afterEach, describe, expect, vi, it } from 'vitest'
import {
  formatBuildTime,
  judgeUpdate,
  fetchRemoteBuildInfo,
  checkUpdate,
  clearCachesAndReload,
  type BuildInfo,
} from './version'

const local = (y: number, m: number, d: number, h: number, min: number): number =>
  new Date(y, m - 1, d, h, min).getTime()

const current: BuildInfo = { version: '0.2.0', buildTime: local(2026, 10, 15, 12, 0) }

describe('formatBuildTime', () => {
  it('按本地时间输出 MM-DD HH:mm，单位数补零', () => {
    expect(formatBuildTime(local(2026, 10, 15, 9, 5))).toBe('10-15 09:05')
  })

  it('跨年日期正常格式化', () => {
    expect(formatBuildTime(local(2026, 1, 3, 23, 59))).toBe('01-03 23:59')
  })
})

describe('judgeUpdate', () => {
  it('远端更新 → outdated', () => {
    expect(judgeUpdate({ version: '0.3.0', buildTime: current.buildTime + 1 }, current)).toBe('outdated')
  })

  it('远端相同或更旧 → latest', () => {
    expect(judgeUpdate({ ...current }, current)).toBe('latest')
    expect(judgeUpdate({ version: '0.1.0', buildTime: current.buildTime - 1 }, current)).toBe('latest')
  })

  it('远端缺失或 buildTime 非法 → unknown', () => {
    expect(judgeUpdate(null, current)).toBe('unknown')
    expect(judgeUpdate(undefined, current)).toBe('unknown')
    expect(judgeUpdate({ version: 'x', buildTime: Number.NaN }, current)).toBe('unknown')
    expect(judgeUpdate({ version: 'x', buildTime: Number.POSITIVE_INFINITY }, current)).toBe('unknown')
  })
})

describe('fetchRemoteBuildInfo', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('返回合法构建信息，且带 no-store 与时间戳参数', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ version: '0.3.0', buildTime: 123456 }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const info = await fetchRemoteBuildInfo()
    expect(info).toEqual({ version: '0.3.0', buildTime: 123456 })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url.startsWith('/version.json?t=')).toBe(true)
    expect(init?.cache).toBe('no-store')
  })

  it('HTTP 非 2xx → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    await expect(fetchRemoteBuildInfo()).resolves.toBeNull()
  })

  it('网络异常 → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))
    await expect(fetchRemoteBuildInfo()).resolves.toBeNull()
  })

  it('JSON 字段非法 → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"version":"x"}', { status: 200 })))
    await expect(fetchRemoteBuildInfo()).resolves.toBeNull()
  })
})

describe('checkUpdate', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('串联 fetch 与判断：远端新 → outdated', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ version: '9.9.9', buildTime: local(2026, 10, 16, 0, 0) }), { status: 200 }),
    ))
    await expect(checkUpdate()).resolves.toBe('outdated')
  })

  it('远端不可用 → unknown', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })))
    await expect(checkUpdate()).resolves.toBe('unknown')
  })
})

describe('clearCachesAndReload', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('删除全部缓存、注销全部 SW 后刷新页面', async () => {
    const del = vi.fn(async () => true)
    const unregister = vi.fn(async () => true)
    const reload = vi.fn()
    vi.stubGlobal('caches', { keys: vi.fn(async () => ['precache', 'other']), delete: del })
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn(async () => [{ unregister }]) } })
    vi.stubGlobal('location', { reload })

    await clearCachesAndReload()

    expect(del).toHaveBeenCalledWith('precache')
    expect(del).toHaveBeenCalledWith('other')
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('清理抛错也必须刷新页面', async () => {
    const reload = vi.fn()
    vi.stubGlobal('caches', { keys: vi.fn(async () => { throw new Error('boom') }), delete: vi.fn() })
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('location', { reload })

    await clearCachesAndReload()

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
