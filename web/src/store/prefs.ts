import { DEFAULT_TEMPLATE, isTemplateId, type TemplateId } from '../templates/catalog'
import { DEFAULT_THEME, isThemeId, type ThemeId } from '../templates/themes'
import { storage } from './storage'

/** 设备级偏好（不属于简历内容，将来云同步也不同步它） */
const TEMPLATE_KEY = 'showme.template'
const THEME_KEY = 'showme.theme'
const ZOOM_KEY = 'showme.previewZoom'
const ONBOARDED_KEY = 'showme.onboarded'

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

/** 预览缩放方式：整页（概览构图）/ 适应宽度 / 100% 原尺寸 */
export const PREVIEW_ZOOMS = ['page', 'width', 'actual'] as const
export type PreviewZoom = (typeof PREVIEW_ZOOMS)[number]

export function isPreviewZoom(v: unknown): v is PreviewZoom {
  return typeof v === 'string' && (PREVIEW_ZOOMS as readonly string[]).includes(v)
}

export function loadZoomPref(): PreviewZoom | null {
  const v = storage.get(ZOOM_KEY)
  return isPreviewZoom(v) ? v : null
}

export function saveZoomPref(v: PreviewZoom): void {
  storage.set(ZOOM_KEY, v)
}

/** 首次进入的「空白 / 示例」选择是否已经问过 */
export function loadOnboardedPref(): boolean {
  return storage.get(ONBOARDED_KEY) === '1'
}

export function saveOnboardedPref(): void {
  storage.set(ONBOARDED_KEY, '1')
}
