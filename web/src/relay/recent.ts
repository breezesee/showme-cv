import { storage } from '../store/storage'
import type { ShortLinkTtl } from './cloud'
import type { SharePermission } from './link'

/** 最近生成的分享链接：保留吊销凭证，过期后自动清理 */
const KEY = 'showme.recentLinks.v1'
export const MAX_RECENT_LINKS = 5

export interface RecentLink {
  id: string
  url: string
  expiresAt: number
  permission: SharePermission
  ttlDays: ShortLinkTtl
  revokeToken: string
  /** 生成时的内容快照，用于提示「内容已修改」 */
  snapshot: string
  createdAt: number
}

const ID_PATTERN = /^[0-9A-Za-z]{10}$/

function isRecentLink(value: unknown): value is RecentLink {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    ID_PATTERN.test(v.id) &&
    typeof v.url === 'string' &&
    v.url.startsWith('http') &&
    typeof v.expiresAt === 'number' &&
    Number.isFinite(v.expiresAt) &&
    (v.permission === 'view' || v.permission === 'edit') &&
    (v.ttlDays === 7 || v.ttlDays === 30) &&
    typeof v.revokeToken === 'string' &&
    typeof v.snapshot === 'string' &&
    typeof v.createdAt === 'number'
  )
}

/** 解析存储值：丢弃结构非法与已过期的条目，最多保留 5 条 */
export function parseRecentLinks(raw: string | null, now = Date.now()): RecentLink[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data
    .filter(isRecentLink)
    .filter((link) => link.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_RECENT_LINKS)
}

export function mergeRecentLinks(
  existing: readonly RecentLink[],
  link: RecentLink,
  now = Date.now(),
): RecentLink[] {
  return [link, ...existing.filter((item) => item.id !== link.id)]
    .filter((item) => item.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_RECENT_LINKS)
}

export function loadRecentLinks(now = Date.now()): RecentLink[] {
  return parseRecentLinks(storage.get(KEY), now)
}

function persist(links: readonly RecentLink[]): RecentLink[] {
  storage.set(KEY, JSON.stringify(links))
  return [...links]
}

export function addRecentLink(link: RecentLink, now = Date.now()): RecentLink[] {
  return persist(mergeRecentLinks(loadRecentLinks(now), link, now))
}

export function removeRecentLink(id: string, now = Date.now()): RecentLink[] {
  return persist(loadRecentLinks(now).filter((link) => link.id !== id))
}
