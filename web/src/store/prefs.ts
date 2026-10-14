import { DEFAULT_TEMPLATE, isTemplateId, type TemplateId } from '../templates/catalog'
import { DEFAULT_THEME, isThemeId, type ThemeId } from '../templates/themes'
import { storage } from './storage'

/** 设备级偏好（不属于简历内容，将来云同步也不同步它） */
const TEMPLATE_KEY = 'showme.template'
const THEME_KEY = 'showme.theme'

export function loadTemplatePref(): TemplateId {
  const v = storage.get(TEMPLATE_KEY)
  return isTemplateId(v) ? v : DEFAULT_TEMPLATE
}

export function saveTemplatePref(id: TemplateId): void {
  storage.set(TEMPLATE_KEY, id)
}

export function loadThemePref(): ThemeId {
  const v = storage.get(THEME_KEY)
  return isThemeId(v) ? v : DEFAULT_THEME
}

export function saveThemePref(id: ThemeId): void {
  storage.set(THEME_KEY, id)
}
