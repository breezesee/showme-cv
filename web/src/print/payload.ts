import { normalizeResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { storage } from '../store/storage'
import { isTemplateId, type TemplateId } from '../templates/catalog'
import { DEFAULT_THEME, isThemeId, type ThemeId } from '../templates/themes'

/** 主界面 → 打印页的数据交接（打印页可能在新标签页打开，故经本地存储传递） */
const PAYLOAD_KEY = 'showme.print.payload'

export interface PrintPayload {
  resume: Resume
  templateId: TemplateId
  themeId: ThemeId
}

export function savePrintPayload(payload: PrintPayload): boolean {
  return storage.set(PAYLOAD_KEY, JSON.stringify(payload))
}

export function loadPrintPayload(): PrintPayload | null {
  const raw = storage.get(PAYLOAD_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as { resume?: unknown; templateId?: unknown; themeId?: unknown }
    if (!isTemplateId(data.templateId)) return null
    // themeId 是后加的字段：旧载荷缺失时用默认主题
    return {
      resume: normalizeResume(data.resume),
      templateId: data.templateId,
      themeId: isThemeId(data.themeId) ? data.themeId : DEFAULT_THEME,
    }
  } catch {
    return null
  }
}
