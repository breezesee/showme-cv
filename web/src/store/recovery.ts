import { normalizeResume } from '../model/normalize'
import { isTemplateId, DEFAULT_TEMPLATE, type TemplateId } from '../templates/catalog'
import { isThemeId, DEFAULT_THEME, type ThemeId } from '../templates/themes'
import { storage } from './storage'

/** 未登录且未保存时的本地恢复草稿；只保留最近一份 */
export const RECOVERY_KEY = 'showme.recovery.v1'

export interface RecoveryDraft {
  resume: ReturnType<typeof normalizeResume>
  templateId: TemplateId
  themeId: ThemeId
  docName: string
  at: number
}

export function parseRecoveryDraft(raw: string | null): RecoveryDraft | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (!record.resume || typeof record.resume !== 'object') return null
  try {
    return {
      resume: normalizeResume(record.resume),
      templateId: isTemplateId(record.templateId) ? record.templateId : DEFAULT_TEMPLATE,
      themeId: isThemeId(record.themeId) ? record.themeId : DEFAULT_THEME,
      docName: typeof record.docName === 'string' ? record.docName : '',
      at: typeof record.at === 'number' && Number.isFinite(record.at) ? record.at : Date.now(),
    }
  } catch {
    return null
  }
}

export function readRecoveryDraft(): RecoveryDraft | null {
  return parseRecoveryDraft(storage.get(RECOVERY_KEY))
}

export function writeRecoveryDraft(draft: RecoveryDraft): boolean {
  return storage.set(RECOVERY_KEY, JSON.stringify(draft))
}

export function clearRecoveryDraft(): void {
  storage.remove(RECOVERY_KEY)
}
