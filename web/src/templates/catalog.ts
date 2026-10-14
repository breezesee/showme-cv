/** 三套模板的元数据（纯数据，供应用与 vite.config 共用） */
export const TEMPLATES = [
  { id: 'classic', name: '简雅' },
  { id: 'air', name: '清朗' },
  { id: 'duo', name: '双栏' },
] as const

export type TemplateId = (typeof TEMPLATES)[number]['id']

export const DEFAULT_TEMPLATE: TemplateId = 'classic'

export const TEMPLATE_IDS: readonly TemplateId[] = TEMPLATES.map((t) => t.id)

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === 'string' && (TEMPLATE_IDS as readonly string[]).includes(v)
}
