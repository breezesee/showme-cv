import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SHARE_VIEW_TTL_MS,
  consumeShareViewExit,
  markShareView,
  parseShareViewMarker,
} from './shareSession'

const NOW = 1_800_000_000_000

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

describe('parseShareViewMarker', () => {
  it('读取有效时间戳', () => {
    expect(parseShareViewMarker(JSON.stringify({ at: NOW }), NOW)).toBe(NOW)
  })

  it('过期、未来时间与非法数据一律丢弃', () => {
    expect(parseShareViewMarker(JSON.stringify({ at: NOW - SHARE_VIEW_TTL_MS - 1 }), NOW)).toBeNull()
    expect(parseShareViewMarker(JSON.stringify({ at: NOW + 1 }), NOW)).toBeNull()
    expect(parseShareViewMarker(JSON.stringify({ at: '昨天' }), NOW)).toBeNull()
    expect(parseShareViewMarker('{oops', NOW)).toBeNull()
    expect(parseShareViewMarker(null, NOW)).toBeNull()
  })
})

describe('分享查看标记', () => {
  it('标记后消费一次返回 true，再次消费返回 false', () => {
    markShareView(NOW)
    expect(consumeShareViewExit(NOW + 1000)).toBe(true)
    expect(consumeShareViewExit(NOW + 2000)).toBe(false)
  })

  it('过期标记也会被消费清除，但不提示', () => {
    markShareView(NOW)
    expect(consumeShareViewExit(NOW + SHARE_VIEW_TTL_MS + 1)).toBe(false)
    expect(consumeShareViewExit(NOW + SHARE_VIEW_TTL_MS + 2)).toBe(false)
  })
})
