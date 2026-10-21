import { describe, expect, it } from 'vitest'
import {
  actionLabel,
  banState,
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  shortId,
} from './adminFormat'

describe('时间格式化（统一按北京时间展示）', () => {
  it('formatDateTime 输出 YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime('2026-01-01T19:04:00Z')).toBe('2026-01-02 03:04')
    expect(formatDateTime('2026-10-21T04:00:00Z')).toBe('2026-10-21 12:00')
  })

  it('formatDate 输出 YYYY-MM-DD', () => {
    expect(formatDate('2026-12-09T04:00:00Z')).toBe('2026-12-09')
    expect(formatDate('2026-12-09T20:00:00Z')).toBe('2026-12-10')
  })

  it('无效或空值显示破折号', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('not-a-date')).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  it('formatRelative 覆盖刚刚 / 分钟 / 小时 / 天 / 久远', () => {
    const now = new Date('2026-10-21T12:00:00Z')
    expect(formatRelative('2026-10-21T11:59:40Z', now)).toBe('刚刚')
    expect(formatRelative('2026-10-21T11:55:00Z', now)).toBe('5 分钟前')
    expect(formatRelative('2026-10-21T09:00:00Z', now)).toBe('3 小时前')
    expect(formatRelative('2026-10-19T12:00:00Z', now)).toBe('2 天前')
    expect(formatRelative('2026-08-01T12:00:00Z', now)).toBe(formatDateTime('2026-08-01T12:00:00Z'))
    expect(formatRelative('2026-10-22T12:00:00Z', now)).toBe('刚刚')
    expect(formatRelative(null, now)).toBe('—')
  })
})

describe('数值格式化', () => {
  it('formatBytes 按 B/KB/MB/GB 缩放并去掉多余小数', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(750)).toBe('750 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB')
  })

  it('formatBytes 拒绝负数与非数值', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
  })

  it('formatNumber 千分位，异常值显示破折号', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('禁用状态', () => {
  const now = new Date('2026-10-21T12:00:00Z')

  it('无禁用时间为正常', () => {
    expect(banState(null, now)).toEqual({ banned: false, label: '正常' })
    expect(banState(undefined, now)).toEqual({ banned: false, label: '正常' })
    expect(banState('', now)).toEqual({ banned: false, label: '正常' })
  })

  it('已过期视为正常', () => {
    expect(banState('2026-01-01T00:00:00Z', now)).toEqual({ banned: false, label: '正常' })
  })

  it('临时禁用显示截止日期', () => {
    expect(banState('2026-11-01T04:00:00Z', now)).toEqual({ banned: true, label: '禁用至 2026-11-01' })
  })

  it('超长期禁用显示「已禁用」', () => {
    expect(banState('2126-10-21T00:00:00Z', now)).toEqual({ banned: true, label: '已禁用' })
  })

  it('非法时间按正常处理', () => {
    expect(banState('bad', now)).toEqual({ banned: false, label: '正常' })
  })
})

describe('审计动作与 ID', () => {
  it('actionLabel 翻译已知动作并保留未知动作', () => {
    expect(actionLabel('user.ban')).toBe('禁用登录')
    expect(actionLabel('user.unban')).toBe('恢复登录')
    expect(actionLabel('user.reset_password')).toBe('发送重置邮件')
    expect(actionLabel('custom.action')).toBe('custom.action')
  })

  it('shortId 截取前 8 位', () => {
    expect(shortId('0faaf427-7e8b-4c13-805a-86bde04c71b0')).toBe('0faaf427')
    expect(shortId('abc')).toBe('abc')
    expect(shortId('')).toBe('—')
  })
})
