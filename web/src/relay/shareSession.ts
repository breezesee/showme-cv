import { session } from '../store/storage'

/**
 * 分享查看标记：进入分享页时写入，刷新后据此提示「已退出分享查看」。
 * 接收页会立刻从地址栏移除链接与密钥，刷新后只能回到本机简历；
 * 若没有提示，用户容易把本机简历误认为分享内容仍然有效。
 */
export const SHARE_VIEW_KEY = 'showme.shareView.v1'
export const SHARE_VIEW_TTL_MS = 24 * 60 * 60 * 1000

export function parseShareViewMarker(raw: string | null, now = Date.now()): number | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const at = (data as { at?: unknown }).at
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  const age = now - at
  if (age < 0 || age > SHARE_VIEW_TTL_MS) return null
  return at
}

export function markShareView(now = Date.now()): void {
  session.set(SHARE_VIEW_KEY, JSON.stringify({ at: now }))
}

export function clearShareView(): void {
  session.remove(SHARE_VIEW_KEY)
}

/** 读取并消费标记；返回 true 表示刚刚刷新退出分享页，应提示用户 */
export function consumeShareViewExit(now = Date.now()): boolean {
  const raw = session.get(SHARE_VIEW_KEY)
  if (raw === null) return false
  session.remove(SHARE_VIEW_KEY)
  return parseShareViewMarker(raw, now) !== null
}
