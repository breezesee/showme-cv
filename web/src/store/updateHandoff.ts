import { normalizeResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { DEFAULT_TEMPLATE, isTemplateId, type TemplateId } from '../templates/catalog'
import { DEFAULT_THEME, isThemeId, type ThemeId } from '../templates/themes'
import { session } from './storage'

/**
 * 更新前交接快照：点击「立即更新」时写入 sessionStorage，整页刷新后由 store 消费。
 * 一次性、带 TTL；写入失败时调用方必须中止更新，避免丢内容。
 */
export const UPDATE_HANDOFF_KEY = 'showme.updateHandoff.v1'
export const UPDATE_HANDOFF_TTL_MS = 30 * 60 * 1000

export interface UpdateHandoff {
  resume: Resume
  baseline: Resume
  templateId: TemplateId
  themeId: ThemeId
  docName: string
  docId: string | null
  docUpdatedAt: string | null
  savedAt: number | null
  lastScope: 'local' | 'cloud' | ''
  fromBuildTime: number
  at: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function parseUpdateHandoff(raw: string | null, now = Date.now()): UpdateHandoff | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const o = data as Record<string, unknown>
  if (typeof o.resume !== 'object' || o.resume === null) return null
  // 没有基线就无法还原「是否已保存」；宁可拒绝，也不能把未保存内容标成已保存
  if (typeof o.baseline !== 'object' || o.baseline === null) return null
  if (!isFiniteNumber(o.at) || !isFiniteNumber(o.fromBuildTime)) return null
  if (o.at > now || now - o.at > UPDATE_HANDOFF_TTL_MS) return null
  try {
    return {
      resume: normalizeResume(o.resume),
      baseline: normalizeResume(o.baseline),
      templateId: isTemplateId(o.templateId) ? o.templateId : DEFAULT_TEMPLATE,
      themeId: isThemeId(o.themeId) ? o.themeId : DEFAULT_THEME,
      docName: typeof o.docName === 'string' ? o.docName : '',
      docId: typeof o.docId === 'string' && o.docId ? o.docId : null,
      docUpdatedAt: typeof o.docUpdatedAt === 'string' && o.docUpdatedAt ? o.docUpdatedAt : null,
      savedAt: isFiniteNumber(o.savedAt) ? o.savedAt : null,
      lastScope: o.lastScope === 'local' || o.lastScope === 'cloud' ? o.lastScope : '',
      fromBuildTime: o.fromBuildTime,
      at: o.at,
    }
  } catch {
    return null
  }
}

/** 写入交接快照；返回 false 表示存储不可用或配额不足，调用方不得刷新 */
export function writeUpdateHandoff(handoff: UpdateHandoff): boolean {
  try {
    return session.set(UPDATE_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    return false
  }
}

/** 读取并立即删除快照：无论内容是否有效都只消费一次 */
export function takeUpdateHandoff(now = Date.now()): UpdateHandoff | null {
  const raw = session.get(UPDATE_HANDOFF_KEY)
  if (raw === null) return null
  session.remove(UPDATE_HANDOFF_KEY)
  return parseUpdateHandoff(raw, now)
}
