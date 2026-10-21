import { describe, expect, it } from 'vitest'
import {
  MAX_RECENT_LINKS,
  mergeRecentLinks,
  parseRecentLinks,
  type RecentLink,
} from './recent'

const NOW = 1_800_000_000_000

function link(id: string, overrides: Partial<RecentLink> = {}): RecentLink {
  return {
    id,
    url: `https://showme.test/#s=1.${id}.key`,
    expiresAt: NOW + 7 * 24 * 3600 * 1000,
    permission: 'view',
    ttlDays: 7,
    revokeToken: 'A'.repeat(43),
    snapshot: '[]',
    createdAt: NOW,
    ...overrides,
  }
}

describe('parseRecentLinks', () => {
  it('丢弃损坏、结构非法与已过期的条目', () => {
    const raw = JSON.stringify([
      link('a1B2c3D4e5'),
      link('bad id'),
      { ...link('a1B2c3D4e6'), permission: 'admin' },
      link('a1B2c3D4e7', { expiresAt: NOW - 1 }),
      null,
    ])
    expect(parseRecentLinks(raw, NOW).map((l) => l.id)).toEqual(['a1B2c3D4e5'])
    expect(parseRecentLinks('{oops', NOW)).toEqual([])
    expect(parseRecentLinks(null, NOW)).toEqual([])
  })

  it('按创建时间倒序并最多保留 5 条', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      link(`a1B2c3D4e${i}`, { createdAt: NOW - i * 1000 }),
    )
    const parsed = parseRecentLinks(JSON.stringify(items), NOW)
    expect(parsed).toHaveLength(MAX_RECENT_LINKS)
    expect(parsed[0]!.id).toBe('a1B2c3D4e0')
  })
})

describe('mergeRecentLinks', () => {
  it('新链接置顶、同 id 去重、过期项清理', () => {
    const older = link('a1B2c3D4e5', { createdAt: NOW - 1000 })
    const expired = link('a1B2c3D4e6', { expiresAt: NOW - 1 })
    const fresh = link('a1B2c3D4e7', { createdAt: NOW + 1 })
    const merged = mergeRecentLinks([older, expired], fresh, NOW)
    expect(merged.map((l) => l.id)).toEqual(['a1B2c3D4e7', 'a1B2c3D4e5'])

    const replaced = mergeRecentLinks(merged, link('a1B2c3D4e5', { createdAt: NOW + 2 }), NOW)
    expect(replaced.map((l) => l.id)).toEqual(['a1B2c3D4e5', 'a1B2c3D4e7'])
  })
})
