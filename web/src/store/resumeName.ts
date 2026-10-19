import type { Resume } from '../model/resume'

/** 简历名称长度上限（数据库 text，无额外限制；限制来自产品体验） */
export const MAX_RESUME_NAME = 60

/**
 * 名称清洗：去首尾空白、连续空白折叠为一个空格、截断至上限。
 * 截断后再 trim，避免留下尾随空格。
 */
export function cleanResumeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_RESUME_NAME).trim()
}

/**
 * 生成不会重复的有意义名称：
 * 姓名-求职意向 → 姓名 → 意向简历 → 我的简历 MM-DD；重名追加（2）（3）…
 * 比较时忽略大小写与首尾空白，避免视觉上相同的名称并存。
 */
export function suggestResumeName(
  resume: Resume,
  existing: readonly string[],
  now: Date = new Date(),
): string {
  const name = cleanResumeName(resume.basics.name)
  const title = cleanResumeName(resume.basics.title)
  const pad = (n: number) => String(n).padStart(2, '0')
  let base: string
  if (name && title) base = `${name}-${title}`
  else if (name) base = name
  else if (title) base = `${title}简历`
  else base = `我的简历 ${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  base = cleanResumeName(base)

  const taken = new Set(existing.map((n) => cleanResumeName(n).toLocaleLowerCase()))
  if (!taken.has(base.toLocaleLowerCase())) return base

  for (let i = 2; i < 1000; i++) {
    const suffix = `（${i}）`
    const candidate = cleanResumeName(base.slice(0, MAX_RESUME_NAME - suffix.length) + suffix)
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate
  }
  // 理论上不可达：同一天同一份简历不会需要上千个副本
  return base
}
