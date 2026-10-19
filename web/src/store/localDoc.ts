import { storage } from './storage'

/** 匿名模式当前简历的名称（与简历 JSON 分开存，避免改变既有数据格式） */
const KEY = 'showme.resume.name.v1'

export function loadLocalDocName(): string {
  const raw = storage.get(KEY)
  if (!raw) return ''
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'string' ? value.trim().slice(0, 60) : ''
  } catch {
    return ''
  }
}

export function saveLocalDocName(name: string): void {
  storage.set(KEY, JSON.stringify(name.trim().slice(0, 60)))
}
