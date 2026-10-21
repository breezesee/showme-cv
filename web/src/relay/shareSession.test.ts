import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CloudRelayError } from './cloud'
import {
  SHARE_VIEW_TTL_MS,
  classifyShareFailure,
  clearShareView,
  parseShareViewSnapshot,
  readShareView,
  rememberShareView,
} from './shareSession'

const NOW = 1_800_000_000_000
const SHORT_HASH = '#s=1.a1B2c3D4e5.' + 'k'.repeat(43)
const LONG_HASH = '#r=2.N4IgK'

const sessionMap = new Map<string, string>()

beforeEach(() => {
  sessionMap.clear()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => sessionMap.get(key) ?? null,
      setItem: (key: string, value: string) => sessionMap.set(key, value),
      removeItem: (key: string) => sessionMap.delete(key),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseShareViewSnapshot', () => {
  it('读取有效的分享 hash 与时间戳', () => {
    expect(parseShareViewSnapshot(JSON.stringify({ hash: SHORT_HASH, at: NOW }), NOW)).toEqual({
      hash: SHORT_HASH,
      at: NOW,
    })
    expect(parseShareViewSnapshot(JSON.stringify({ hash: LONG_HASH, at: NOW }), NOW)).toEqual({
      hash: LONG_HASH,
      at: NOW,
    })
  })

  it('过期、未来时间、非法 JSON 与非分享 hash 一律丢弃', () => {
    expect(parseShareViewSnapshot(JSON.stringify({ hash: SHORT_HASH, at: NOW - SHARE_VIEW_TTL_MS - 1 }), NOW)).toBeNull()
    expect(parseShareViewSnapshot(JSON.stringify({ hash: SHORT_HASH, at: NOW + 1 }), NOW)).toBeNull()
    expect(parseShareViewSnapshot(JSON.stringify({ hash: SHORT_HASH, at: '昨天' }), NOW)).toBeNull()
    expect(parseShareViewSnapshot('{oops', NOW)).toBeNull()
    expect(parseShareViewSnapshot(JSON.stringify({ hash: '#top', at: NOW }), NOW)).toBeNull()
    expect(parseShareViewSnapshot(JSON.stringify({ hash: 'https://x/#r=2.a', at: NOW }), NOW)).toBeNull()
    expect(parseShareViewSnapshot(JSON.stringify({ at: NOW }), NOW)).toBeNull()
    expect(parseShareViewSnapshot(null, NOW)).toBeNull()
  })
})

describe('分享查看会话', () => {
  it('记住后可在刷新时读回同一个 hash', () => {
    rememberShareView(SHORT_HASH, NOW)
    expect(readShareView(NOW + 1000)).toEqual({ hash: SHORT_HASH, at: NOW })
  })

  it('非分享 hash 不写入', () => {
    rememberShareView('#top', NOW)
    rememberShareView('', NOW)
    expect(readShareView(NOW)).toBeNull()
  })

  it('过期快照读取时清除', () => {
    rememberShareView(LONG_HASH, NOW)
    expect(readShareView(NOW + SHARE_VIEW_TTL_MS + 1)).toBeNull()
    expect(sessionMap.size).toBe(0)
  })

  it('clearShareView 删除快照', () => {
    rememberShareView(SHORT_HASH, NOW)
    clearShareView()
    expect(readShareView(NOW)).toBeNull()
  })
})

describe('classifyShareFailure', () => {
  it('区分过期、损坏、网络与服务异常', () => {
    expect(classifyShareFailure(new CloudRelayError('expired', ''))).toBe('expired')
    expect(classifyShareFailure(new CloudRelayError('broken', ''))).toBe('broken')
    expect(classifyShareFailure(new CloudRelayError('network', ''))).toBe('network')
    expect(classifyShareFailure(new CloudRelayError('server', ''))).toBe('server')
    expect(classifyShareFailure(new CloudRelayError('unsupported', ''))).toBe('server')
    expect(classifyShareFailure(new CloudRelayError('forbidden', ''))).toBe('server')
    expect(classifyShareFailure(new Error('未知错误'))).toBe('server')
  })
})
