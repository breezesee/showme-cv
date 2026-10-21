import { describe, expect, it } from 'vitest'
import { monthValue, normalizeMonth } from './date'

describe('normalizeMonth', () => {
  it('把常见月份写法统一为 YYYY.MM', () => {
    expect(normalizeMonth('2022.7')).toBe('2022.07')
    expect(normalizeMonth('2022-07')).toBe('2022.07')
    expect(normalizeMonth('2022/7')).toBe('2022.07')
    expect(normalizeMonth('2022年7月')).toBe('2022.07')
    expect(normalizeMonth(' 2022 年 07 月 ')).toBe('2022.07')
    expect(normalizeMonth('2022.7.15')).toBe('2022.07')
    expect(normalizeMonth('2022-07-15')).toBe('2022.07')
  })

  it('现在/至今统一为「至今」', () => {
    for (const value of ['至今', '现在', '今', 'present', 'Present', 'now', 'current']) {
      expect(normalizeMonth(value)).toBe('至今')
    }
  })

  it('裸年份保留，非法月份原样返回', () => {
    expect(normalizeMonth('2022')).toBe('2022')
    expect(normalizeMonth('2022年')).toBe('2022')
    expect(normalizeMonth('2022.13')).toBe('2022.13')
    expect(normalizeMonth('去年')).toBe('去年')
  })

  it('空值与纯空白返回空串', () => {
    expect(normalizeMonth('')).toBe('')
    expect(normalizeMonth('   ')).toBe('')
  })
})

describe('monthValue', () => {
  it('把月份转成可比较的连续月序号', () => {
    expect(monthValue('2022.07')).toBe(2022 * 12 + 6)
    expect(monthValue('2022-7')).toBe(2022 * 12 + 6)
    expect(monthValue('2022')).toBe(2022 * 12)
  })

  it('至今视为无穷大，无法识别为 null', () => {
    expect(monthValue('至今')).toBe(Number.POSITIVE_INFINITY)
    expect(monthValue('now')).toBe(Number.POSITIVE_INFINITY)
    expect(monthValue('去年')).toBeNull()
    expect(monthValue('')).toBeNull()
  })
})
