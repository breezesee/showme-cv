/**
 * 简历日期归一化：只处理“年 + 月”，保留裸年份与无法识别的原文。
 * 展示层与导入层共用，避免同一份简历出现 2022-7 / 2022年7月 / 2022.07 三种写法。
 */

const PRESENT_RE = /^(?:至今|现在|今|present|now|current)$/i
const YEAR_RE = /^(\d{4})(?:\s*年)?$/
/** 2022.7 / 2022-07 / 2022/7 / 2022年7月 / 2022-07-15；日部分忽略 */
const MONTH_RE = /^(\d{4})\s*[.\-/年]\s*(\d{1,2})\s*月?(?:\s*[.\-/]\s*\d{1,2}\s*日?)?$/

export function normalizeMonth(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (PRESENT_RE.test(value)) return '至今'
  const year = YEAR_RE.exec(value)
  if (year) return year[1]!
  const month = MONTH_RE.exec(value)
  if (month) {
    const m = Number(month[2])
    if (m >= 1 && m <= 12) return `${month[1]}.${String(m).padStart(2, '0')}`
  }
  return value
}

/** 用于比较先后：连续月序号；至今为 +∞，无法识别为 null */
export function monthValue(raw: string): number | null {
  const value = normalizeMonth(raw)
  if (!value) return null
  if (value === '至今') return Number.POSITIVE_INFINITY
  const match = /^(\d{4})(?:\.(\d{2}))?$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = match[2] ? Number(match[2]) : 1
  return year * 12 + (month - 1)
}
