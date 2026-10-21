import { isValidCustomId, reconcileLayout } from './layout'
import { isPhotoValue } from './photo'
import {
  RESUME_VERSION,
  type BasicExtra,
  type Basics,
  type CustomSection,
  type Education,
  type Project,
  type Resume,
  type SkillGroup,
  type Work,
} from './resume'

/** 数据格式错误：path 指出出错位置，便于排查 */
export class ResumeFormatError extends Error {
  constructor(readonly path: string, detail: string) {
    super(`${path}: ${detail}`)
    this.name = 'ResumeFormatError'
  }
}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(o: Obj, key: string, path: string): string {
  const v = o[key]
  if (v === undefined) return ''
  if (typeof v !== 'string') throw new ResumeFormatError(`${path}.${key}`, '应为字符串')
  return v
}

function strList(o: Obj, key: string, path: string): string[] {
  const v = o[key]
  if (v === undefined) return []
  if (!Array.isArray(v)) throw new ResumeFormatError(`${path}.${key}`, '应为字符串数组')
  return v.map((x, i) => {
    if (typeof x !== 'string') throw new ResumeFormatError(`${path}.${key}[${i}]`, '应为字符串')
    return x
  })
}

function objList<T>(o: Obj, key: string, path: string, read: (item: Obj, path: string) => T): T[] {
  const v = o[key]
  if (v === undefined) return []
  if (!Array.isArray(v)) throw new ResumeFormatError(`${path}.${key}`, '应为数组')
  return v.map((x, i) => {
    const p = `${path}.${key}[${i}]`
    if (!isObj(x)) throw new ResumeFormatError(p, '应为对象')
    return read(x, p)
  })
}

const readExtra = (o: Obj, p: string): BasicExtra => ({
  label: str(o, 'label', p),
  value: str(o, 'value', p),
})

/** 附加项只保留有值的行；空行由编辑器自行占位，不进数据 */
function readExtras(o: Obj, p: string): BasicExtra[] {
  return objList(o, 'extras', p, readExtra).filter((e) => e.value.trim() !== '')
}

/** 照片值非法时静默置空：完整 URL、路径穿越、超长 data URL 不应让整份简历无法导入 */
function readPhoto(o: Obj, p: string): string {
  const value = str(o, 'photo', p)
  return isPhotoValue(value) ? value : ''
}

/**
 * 自定义模块：缺失/非法 id 按 c1、c2… 顺序补齐（重复 normalize 结果稳定），
 * 标题与正文都为空则丢弃。
 */
function readCustomSections(o: Obj, p: string): CustomSection[] {
  const items = objList(o, 'custom', p, (item, path) => ({
    id: typeof item.id === 'string' ? item.id : '',
    title: str(item, 'title', path),
    body: str(item, 'body', path),
  })).filter((s) => s.title.trim() !== '' || s.body.trim() !== '')

  const used = new Set<string>()
  let next = 1
  return items.map((s) => {
    let id = s.id
    if (!isValidCustomId(id) || used.has(id)) {
      while (used.has(`c${next}`)) next++
      id = `c${next}`
    }
    used.add(id)
    return { ...s, id }
  })
}

const readBasics = (o: Obj, p: string): Basics => ({
  name: str(o, 'name', p),
  title: str(o, 'title', p),
  phone: str(o, 'phone', p),
  email: str(o, 'email', p),
  city: str(o, 'city', p),
  summary: str(o, 'summary', p),
  extras: readExtras(o, p),
  photo: readPhoto(o, p),
})

const readEducation = (o: Obj, p: string): Education => ({
  school: str(o, 'school', p),
  major: str(o, 'major', p),
  degree: str(o, 'degree', p),
  start: str(o, 'start', p),
  end: str(o, 'end', p),
  notes: str(o, 'notes', p),
})

const readWork = (o: Obj, p: string): Work => ({
  company: str(o, 'company', p),
  position: str(o, 'position', p),
  start: str(o, 'start', p),
  end: str(o, 'end', p),
  description: str(o, 'description', p),
  highlights: strList(o, 'highlights', p),
})

const readProject = (o: Obj, p: string): Project => ({
  name: str(o, 'name', p),
  role: str(o, 'role', p),
  start: str(o, 'start', p),
  end: str(o, 'end', p),
  description: str(o, 'description', p),
})

const readSkillGroup = (o: Obj, p: string): SkillGroup => ({
  category: str(o, 'category', p),
  items: strList(o, 'items', p),
})

/**
 * 所有外部数据（本地存储、JSON 导入、接力链接）的唯一入口校验。
 * 语义对齐 Android 版 kotlinx：缺失字段取默认值、未知字段忽略、类型不符即非法。
 */
export function normalizeResume(input: unknown): Resume {
  if (!isObj(input)) throw new ResumeFormatError('$', '应为对象')
  const version = input.version
  if (version !== undefined && !(typeof version === 'number' && Number.isInteger(version))) {
    throw new ResumeFormatError('$.version', '应为整数')
  }
  const basics = input.basics
  if (basics !== undefined && !isObj(basics)) throw new ResumeFormatError('$.basics', '应为对象')
  const custom = readCustomSections(input, '$')
  return {
    version: RESUME_VERSION,
    basics: readBasics(basics ?? {}, '$.basics'),
    education: objList(input, 'education', '$', readEducation),
    work: objList(input, 'work', '$', readWork),
    projects: objList(input, 'projects', '$', readProject),
    skills: objList(input, 'skills', '$', readSkillGroup),
    custom,
    layout: reconcileLayout(input.layout, custom.map((c) => c.id)),
  }
}

/** 解析 JSON 文本并校验；JSON 语法错误同样以 ResumeFormatError 抛出 */
export function parseResumeJson(text: string): Resume {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ResumeFormatError('$', '不是合法的 JSON')
  }
  return normalizeResume(data)
}

/** 两份简历内容是否一致（结构固定、键序一致，可直接比较序列化结果） */
export function sameResume(a: Resume, b: Resume): boolean {
  return JSON.stringify(normalizeResume(a)) === JSON.stringify(normalizeResume(b))
}
