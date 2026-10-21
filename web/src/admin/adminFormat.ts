/** 管理台展示格式化：时间统一按北京时间，避免运营在不同设备上看到不同日期 */

const ZONE = 'Asia/Shanghai'
const DATE_TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function parts(d: Date, fmt: Intl.DateTimeFormat): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = p.value
  }
  return out
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  const p = parts(d, DATE_TIME_FMT)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  const p = parts(d, DATE_FMT)
  return `${p.year}-${p.month}-${p.day}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(value)
  if (!d) return '—'
  const diff = now.getTime() - d.getTime()
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`
  return formatDateTime(d)
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value < 1024) return `${Math.round(value)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = value / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const text = v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, '')
  return `${text} ${units[i]}`
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('zh-CN')
}

/** 100 年的封禁视作永久禁用；其余按截止日期展示 */
export function banState(
  bannedUntil: string | null | undefined,
  now: Date = new Date(),
): { banned: boolean; label: string } {
  const d = toDate(bannedUntil)
  if (!d || d.getTime() <= now.getTime()) return { banned: false, label: '正常' }
  const tenYears = 10 * 365.25 * DAY
  if (d.getTime() - now.getTime() > tenYears) return { banned: true, label: '已禁用' }
  return { banned: true, label: `禁用至 ${formatDate(d)}` }
}

const ACTION_LABELS: Record<string, string> = {
  'user.ban': '禁用登录',
  'user.unban': '恢复登录',
  'user.reset_password': '发送重置邮件',
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export function shortId(id: string): string {
  return id ? id.slice(0, 8) : '—'
}
