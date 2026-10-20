import type { FixedSectionId, ResumeLayout, SectionId } from './resume'

export const FIXED_SECTION_IDS = ['education', 'work', 'projects', 'skills', 'summary'] as const

export const SECTION_TITLES: Record<FixedSectionId, string> = {
  education: '教育经历',
  work: '工作经历',
  projects: '项目经历',
  skills: '技能',
  summary: '自我评价',
}

const CUSTOM_PREFIX = 'custom:'
const CUSTOM_ID_RE = /^[A-Za-z0-9_-]{1,32}$/

export function isValidCustomId(id: string): boolean {
  return CUSTOM_ID_RE.test(id)
}

export function customSectionId(id: string): SectionId {
  return `${CUSTOM_PREFIX}${id}`
}

export function isCustomSectionId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX) && isValidCustomId(id.slice(CUSTOM_PREFIX.length))
}

export function isFixedSectionId(v: unknown): v is FixedSectionId {
  return typeof v === 'string' && (FIXED_SECTION_IDS as readonly string[]).includes(v)
}

/** 默认顺序：固定板块 + 自定义模块（数组顺序），自我评价始终在自定义模块之后 */
export function defaultOrder(customIds: readonly string[]): SectionId[] {
  const fixed = FIXED_SECTION_IDS.filter((id) => id !== 'summary')
  return [
    ...fixed,
    ...customIds.filter(isValidCustomId).map(customSectionId),
    'summary',
  ]
}

export function defaultLayout(customIds: readonly string[]): ResumeLayout {
  return { order: defaultOrder(customIds), hidden: [] }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 布局归一化：只保留已知板块、去重、补齐缺失项；非法结构回到默认。
 * 布局属于排版元数据，不因结构损坏而拒绝整份简历导入。
 */
export function reconcileLayout(input: unknown, customIds: readonly string[]): ResumeLayout {
  const custom = customIds.filter(isValidCustomId)
  const known = new Set<string>([...FIXED_SECTION_IDS, ...custom.map(customSectionId)])
  const raw = isObj(input) ? input : {}

  const order: SectionId[] = []
  if (Array.isArray(raw.order)) {
    for (const value of raw.order) {
      if (typeof value === 'string' && known.has(value) && !order.includes(value as SectionId)) {
        order.push(value as SectionId)
      }
    }
  }
  for (const id of defaultOrder(custom)) {
    if (!order.includes(id)) order.push(id)
  }

  const hidden: SectionId[] = []
  if (Array.isArray(raw.hidden)) {
    for (const value of raw.hidden) {
      if (typeof value === 'string' && known.has(value) && !hidden.includes(value as SectionId)) {
        hidden.push(value as SectionId)
      }
    }
  }
  return { order, hidden }
}

/** 实际渲染顺序：过滤隐藏、未知、重复项，并补齐 layout 中缺失的板块 */
export function visibleSectionIds(layout: ResumeLayout, customIds: readonly string[]): SectionId[] {
  const custom = customIds.filter(isValidCustomId)
  const known = new Set<string>([...FIXED_SECTION_IDS, ...custom.map(customSectionId)])
  const hidden = new Set<string>(layout.hidden)
  const out: SectionId[] = []
  const add = (id: string) => {
    if (known.has(id) && !hidden.has(id) && !out.includes(id as SectionId)) out.push(id as SectionId)
  }
  layout.order.forEach(add)
  defaultOrder(custom).forEach(add)
  return out
}

export function toggleSectionHidden(layout: ResumeLayout, id: SectionId): void {
  const at = layout.hidden.indexOf(id)
  if (at >= 0) layout.hidden.splice(at, 1)
  else if (layout.order.includes(id)) layout.hidden.push(id)
}

export function moveSection(layout: ResumeLayout, id: SectionId, delta: number): void {
  const from = layout.order.indexOf(id)
  if (from < 0) return
  const to = from + delta
  if (to < 0 || to >= layout.order.length) return
  const [item] = layout.order.splice(from, 1)
  layout.order.splice(to, 0, item!)
}

/** 新自定义模块默认放在自我评价之前；没有自我评价时追加到末尾 */
export function insertCustomSection(layout: ResumeLayout, id: string): void {
  const sid = customSectionId(id)
  if (layout.order.includes(sid)) return
  const summaryAt = layout.order.indexOf('summary')
  layout.order.splice(summaryAt < 0 ? layout.order.length : summaryAt, 0, sid)
}
