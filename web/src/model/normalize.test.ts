import { describe, expect, it } from 'vitest'
import { normalizeResume, parseResumeJson, ResumeFormatError, sameResume } from './normalize'
import { emptyResume, sampleResume } from './resume'

describe('normalizeResume', () => {
  it('合法数据原样保留', () => {
    const r = sampleResume()
    expect(normalizeResume(JSON.parse(JSON.stringify(r)))).toEqual(r)
  })

  it('缺失字段补默认值', () => {
    const r = normalizeResume({ work: [{ company: '星海' }] })
    expect(r.basics).toEqual(emptyResume().basics)
    expect(r.work[0]).toEqual({ company: '星海', position: '', start: '', end: '', description: '', highlights: [] })
    expect(r.education).toEqual([])
    expect(r.version).toBe(1)
  })

  it('忽略未知字段', () => {
    const r = normalizeResume({ basics: { name: '张三', avatar: 'x' }, extra: 1 })
    expect(r.basics.name).toBe('张三')
    expect(r).not.toHaveProperty('extra')
    expect(r.basics).not.toHaveProperty('avatar')
  })

  it('类型不符判为非法', () => {
    expect(() => normalizeResume({ basics: { name: 123 } })).toThrow(ResumeFormatError)
    expect(() => normalizeResume({ work: [null] })).toThrow(/\$\.work\[0\]/)
    expect(() => normalizeResume({ skills: [{ items: ['a', 2] }] })).toThrow(/items\[1\]/)
    expect(() => normalizeResume({ education: {} })).toThrow(ResumeFormatError)
    expect(() => normalizeResume({ version: '1' })).toThrow(ResumeFormatError)
    expect(() => normalizeResume([])).toThrow(ResumeFormatError)
    expect(() => normalizeResume(null)).toThrow(ResumeFormatError)
  })

  it('兼容 Android 版导出的 JSON（含全部默认值字段）', () => {
    const android = '{"version":1,"basics":{"name":"李小明","title":"","phone":"","email":"","city":"","summary":""},"education":[],"work":[{"company":"A","position":"","start":"","end":"","highlights":["x",""]}],"projects":[],"skills":[]}'
    const r = parseResumeJson(android)
    expect(r.work[0].highlights).toEqual(['x', ''])
    expect(r.work[0].description).toBe('')
  })

  it('长文本中的换行原样保留', () => {
    const text = '第一行\n\n- 圆点\r\n末行'
    const r = normalizeResume({ work: [{ description: text }], projects: [{ description: text }] })
    expect(r.work[0].description).toBe(text)
    expect(r.projects[0].description).toBe(text)
  })
})

describe('parseResumeJson / sameResume', () => {
  it('非法 JSON 抛出格式错误', () => {
    expect(() => parseResumeJson('{oops')).toThrow(ResumeFormatError)
  })

  it('内容相同即视为同一份简历', () => {
    expect(sameResume(sampleResume(), sampleResume())).toBe(true)
    const b = sampleResume()
    b.basics.name = '王五'
    expect(sameResume(sampleResume(), b)).toBe(false)
  })
})
