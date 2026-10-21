import { session } from '../store/storage'
import { CloudRelayError } from './cloud'

/**
 * 分享查看会话：记住进入分享视图时的地址 hash（短链 id+密钥 / 长链整份数据）。
 * 刷新时地址仍在，走同一套解析与取回；PWA 冷启动或内嵌浏览器丢失 fragment 时，
 * 启动阶段据此把 hash 补回地址，再按原链接重新打开，避免退回自己的编辑器。
 * 只保存链接本身，不额外保存解密后的正文；退出分享、导入编辑或失效后清除。
 */
export const SHARE_VIEW_KEY = 'showme.shareView.v1'
export const SHARE_VIEW_TTL_MS = 24 * 60 * 60 * 1000

export interface ShareViewSnapshot {
  hash: string
  at: number
}

/** 取回短链失败时的展示状态 */
export type ShareFailure = 'expired' | 'broken' | 'network' | 'server'

function isShareHash(hash: string): boolean {
  return hash.startsWith('#r=') || hash.startsWith('#s=')
}

export function parseShareViewSnapshot(raw: string | null, now = Date.now()): ShareViewSnapshot | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const { hash, at } = data as { hash?: unknown; at?: unknown }
  if (typeof hash !== 'string' || !isShareHash(hash) || typeof at !== 'number' || !Number.isFinite(at)) return null
  const age = now - at
  if (age < 0 || age > SHARE_VIEW_TTL_MS) return null
  return { hash, at }
}

export function rememberShareView(hash: string, now = Date.now()): void {
  if (!isShareHash(hash)) return
  session.set(SHARE_VIEW_KEY, JSON.stringify({ hash, at: now }))
}

export function readShareView(now = Date.now()): ShareViewSnapshot | null {
  const raw = session.get(SHARE_VIEW_KEY)
  if (raw === null) return null
  const snapshot = parseShareViewSnapshot(raw, now)
  if (snapshot === null) session.remove(SHARE_VIEW_KEY)
  return snapshot
}

export function clearShareView(): void {
  session.remove(SHARE_VIEW_KEY)
}

export function classifyShareFailure(error: unknown): ShareFailure {
  if (!(error instanceof CloudRelayError)) return 'server'
  if (error.kind === 'expired') return 'expired'
  if (error.kind === 'broken') return 'broken'
  if (error.kind === 'network') return 'network'
  return 'server'
}
