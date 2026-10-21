import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleResume, type Resume } from '../model/resume'
import { DEFAULT_TEMPLATE } from '../templates/catalog'
import { DEFAULT_THEME } from '../templates/themes'
import {
  UPDATE_HANDOFF_TTL_MS,
  parseUpdateHandoff,
  takeUpdateHandoff,
  writeUpdateHandoff,
} from './updateHandoff'

const NOW = 1_800_000_000_000

const sessionMap = new Map<string, string>()
let failWrites = false

beforeEach(() => {
  sessionMap.clear()
  failWrites = false
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => sessionMap.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new Error('quota')
        sessionMap.set(key, value)
      },
      removeItem: (key: string) => sessionMap.delete(key),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function edited(): Resume {
  const resume = sampleResume()
  resume.basics.name = '更新前未保存的姓名'
  return resume
}

function handoffJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    resume: edited(),
    baseline: sampleResume(),
    templateId: 'classic',
    themeId: 'plain',
    docName: '产品经理简历',
    docId: 'doc-1',
    docUpdatedAt: '2026-10-21T10:00:00.000Z',
    savedAt: NOW - 60_000,
    lastScope: 'cloud',
    fromBuildTime: NOW - 120_000,
    at: NOW,
    ...overrides,
  })
}

describe('parseUpdateHandoff', () => {
  it('恢复内容、基线与云端文档身份，并保留未保存差异', () => {
    const parsed = parseUpdateHandoff(handoffJson(), NOW)
    expect(parsed).not.toBeNull()
    expect(parsed!.resume.basics.name).toBe('更新前未保存的姓名')
    expect(parsed!.baseline.basics.name).toBe('李小明')
    expect(parsed!.templateId).toBe('classic')
    expect(parsed!.themeId).toBe('plain')
    expect(parsed!.docName).toBe('产品经理简历')
    expect(parsed!.docId).toBe('doc-1')
    expect(parsed!.docUpdatedAt).toBe('2026-10-21T10:00:00.000Z')
    expect(parsed!.savedAt).toBe(NOW - 60_000)
    expect(parsed!.lastScope).toBe('cloud')
    expect(parsed!.fromBuildTime).toBe(NOW - 120_000)
  })

  it('非法 JSON、缺少简历或缺少基线时拒绝', () => {
    expect(parseUpdateHandoff('{oops', NOW)).toBeNull()
    expect(parseUpdateHandoff(null, NOW)).toBeNull()
    expect(parseUpdateHandoff(JSON.stringify({ baseline: sampleResume(), at: NOW }), NOW)).toBeNull()
    expect(parseUpdateHandoff(JSON.stringify({ resume: sampleResume(), at: NOW }), NOW)).toBeNull()
  })

  it('过旧、未来时间或缺少构建时间时拒绝', () => {
    expect(parseUpdateHandoff(handoffJson({ at: NOW - UPDATE_HANDOFF_TTL_MS - 1 }), NOW)).toBeNull()
    expect(parseUpdateHandoff(handoffJson({ at: NOW + 1 }), NOW)).toBeNull()
    expect(parseUpdateHandoff(handoffJson({ fromBuildTime: '昨天' }), NOW)).toBeNull()
  })

  it('外观或文档字段非法时回退默认值，内容仍恢复', () => {
    const parsed = parseUpdateHandoff(
      handoffJson({ templateId: 'missing', themeId: 7, docName: null, docId: 3, lastScope: 'elsewhere' }),
      NOW,
    )
    expect(parsed).not.toBeNull()
    expect(parsed!.templateId).toBe(DEFAULT_TEMPLATE)
    expect(parsed!.themeId).toBe(DEFAULT_THEME)
    expect(parsed!.docName).toBe('')
    expect(parsed!.docId).toBeNull()
    expect(parsed!.lastScope).toBe('')
  })
})

describe('updateHandoff 存取', () => {
  it('写入后只能消费一次', () => {
    const parsed = parseUpdateHandoff(handoffJson(), NOW)!
    expect(writeUpdateHandoff(parsed)).toBe(true)
    expect(takeUpdateHandoff(NOW + 1000)?.resume.basics.name).toBe('更新前未保存的姓名')
    expect(takeUpdateHandoff(NOW + 2000)).toBeNull()
  })

  it('存储写入失败时返回 false', () => {
    failWrites = true
    const parsed = parseUpdateHandoff(handoffJson(), NOW)!
    expect(writeUpdateHandoff(parsed)).toBe(false)
  })

  it('过期快照会被消费清除，不恢复', () => {
    const parsed = parseUpdateHandoff(handoffJson(), NOW)!
    writeUpdateHandoff(parsed)
    expect(takeUpdateHandoff(NOW + UPDATE_HANDOFF_TTL_MS + 1)).toBeNull()
    expect(takeUpdateHandoff(NOW + UPDATE_HANDOFF_TTL_MS + 2)).toBeNull()
  })
})
