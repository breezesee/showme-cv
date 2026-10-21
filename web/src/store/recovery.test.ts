import { describe, expect, it } from 'vitest'
import { sampleResume } from '../model/resume'
import { DEFAULT_TEMPLATE } from '../templates/catalog'
import { DEFAULT_THEME } from '../templates/themes'
import { parseRecoveryDraft } from './recovery'

function draftJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    resume: sampleResume(),
    templateId: 'classic',
    themeId: 'plain',
    docName: '我的简历',
    at: Date.UTC(2026, 9, 20, 6, 30),
    ...overrides,
  })
}

describe('parseRecoveryDraft', () => {
  it('没有草稿时返回 null', () => {
    expect(parseRecoveryDraft(null)).toBeNull()
    expect(parseRecoveryDraft('')).toBeNull()
  })

  it('无效 JSON 或缺少简历时返回 null', () => {
    expect(parseRecoveryDraft('{')).toBeNull()
    expect(parseRecoveryDraft(JSON.stringify({ templateId: 'classic' }))).toBeNull()
    expect(parseRecoveryDraft(JSON.stringify({ resume: 'text' }))).toBeNull()
  })

  it('读取简历内容与外观，并规范化数据', () => {
    const parsed = parseRecoveryDraft(
      draftJson({ resume: { ...sampleResume(), version: 1, unknown: true } }),
    )
    expect(parsed).not.toBeNull()
    expect(parsed!.resume.basics.name).toBe('李小明')
    expect(parsed!.templateId).toBe('classic')
    expect(parsed!.themeId).toBe('plain')
    expect(parsed!.docName).toBe('我的简历')
    expect(parsed!.at).toBe(Date.UTC(2026, 9, 20, 6, 30))
    expect('unknown' in parsed!.resume).toBe(false)
  })

  it('外观或时间无效时使用默认值，草稿仍可恢复', () => {
    const parsed = parseRecoveryDraft(draftJson({ templateId: 'missing', themeId: 7, at: '昨天', docName: null }))
    expect(parsed).not.toBeNull()
    expect(parsed!.templateId).toBe(DEFAULT_TEMPLATE)
    expect(parsed!.themeId).toBe(DEFAULT_THEME)
    expect(parsed!.docName).toBe('')
    expect(Number.isFinite(parsed!.at)).toBe(true)
  })
})
