import { describe, expect, it } from 'vitest'
import { defaultLayout } from './layout'
import { normalizeResume, parseResumeJson, ResumeFormatError, sameResume } from './normalize'
import { emptyResume, isResumeEmpty, sampleResume } from './resume'

const UID = '3f0e8f7a-1111-4c2b-9d3e-1234567890ab'
const PHOTO_ID = 'a1b2c3d4-2222-4e5f-8a9b-abcdefabcdef'

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

describe('附加项、自定义模块、布局与照片', () => {
  it('旧数据补齐默认值', () => {
    const r = normalizeResume({ basics: { name: '张三' } })
    expect(r.basics.extras).toEqual([])
    expect(r.basics.photo).toBe('')
    expect(r.custom).toEqual([])
    expect(r.layout).toEqual(defaultLayout([]))
  })

  it('附加项保留有内容的项，丢弃空值项', () => {
    const r = normalizeResume({
      basics: {
        extras: [
          { label: '微信', value: 'showme' },
          { label: '空', value: '  ' },
          { label: '', value: 'https://example.com' },
        ],
      },
    })
    expect(r.basics.extras).toEqual([
      { label: '微信', value: 'showme' },
      { label: '', value: 'https://example.com' },
    ])
  })

  it('附加项类型错误仍判为非法', () => {
    expect(() => normalizeResume({ basics: { extras: 'x' } })).toThrow(/extras/)
    expect(() => normalizeResume({ basics: { extras: [{ label: 1, value: 'x' }] } })).toThrow(/label/)
  })

  it('照片接受 Storage 路径与本地 data URL，完整 URL 或非法路径置空', () => {
    const path = `${UID}/${PHOTO_ID}.jpg`
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
    expect(normalizeResume({ basics: { photo: path } }).basics.photo).toBe(path)
    expect(normalizeResume({ basics: { photo: dataUrl } }).basics.photo).toBe(dataUrl)
    expect(normalizeResume({ basics: { photo: `https://x/${path}` } }).basics.photo).toBe('')
    expect(normalizeResume({ basics: { photo: '../x.jpg' } }).basics.photo).toBe('')
    expect(normalizeResume({ basics: { photo: 'data:image/svg+xml;base64,PHN2Zz4=' } }).basics.photo).toBe('')
    expect(() => normalizeResume({ basics: { photo: 1 } })).toThrow(/photo/)
  })

  it('自定义模块生成稳定 id、去重并丢弃空模块', () => {
    const input = {
      custom: [
        { title: '荣誉', body: '- 一等奖' },
        { id: 'awards', title: '证书', body: 'PMP' },
        { id: 'awards', title: '重复 id', body: 'CET-6' },
        { title: ' ', body: ' ' },
      ],
    }
    const first = normalizeResume(input)
    expect(first.custom.map((c) => c.id)).toEqual(['c1', 'awards', 'c2'])
    expect(first.custom).toHaveLength(3)
    // 再次 normalize 不应产生不同的 id（否则会永远显示未保存）
    expect(normalizeResume(first).custom).toEqual(first.custom)
  })

  it('布局非法时回到默认而不阻塞导入', () => {
    const r = normalizeResume({ basics: { name: '张三' }, layout: { order: 'x', hidden: 1 } })
    expect(r.layout).toEqual(defaultLayout([]))
  })

  it('布局过滤未知 id，并保留自定义模块', () => {
    const r = normalizeResume({
      custom: [{ id: 'awards', title: '荣誉', body: '一等奖' }],
      layout: { order: ['work', 'custom:awards', 'custom:missing'], hidden: ['custom:awards', 'nope'] },
    })
    expect(r.layout.order).toContain('custom:awards')
    expect(r.layout.order).not.toContain('custom:missing')
    expect(r.layout.hidden).toEqual(['custom:awards'])
  })

  it('附加项、自定义模块与布局参与内容比较', () => {
    const base = normalizeResume({ basics: { name: '张三' } })
    const withExtra = normalizeResume({ ...base, basics: { ...base.basics, extras: [{ label: '微信', value: 'x' }] } })
    expect(sameResume(base, withExtra)).toBe(false)
    const moved = normalizeResume({ ...base, layout: { ...base.layout, order: ['work', 'education', 'projects', 'skills', 'summary'] } })
    expect(sameResume(base, moved)).toBe(false)
  })

  it('空简历判断：照片和布局不算内容，附加项与自定义正文算内容', () => {
    const blank = emptyResume()
    expect(isResumeEmpty(blank)).toBe(true)
    expect(isResumeEmpty({ ...blank, basics: { ...blank.basics, photo: `${UID}/${PHOTO_ID}.jpg` } })).toBe(true)

    const withExtra = normalizeResume({ basics: { extras: [{ label: '微信', value: 'x' }] } })
    expect(isResumeEmpty(withExtra)).toBe(false)

    const withCustom = normalizeResume({ custom: [{ title: '荣誉', body: '一等奖' }] })
    expect(isResumeEmpty(withCustom)).toBe(false)

    const titleOnly = normalizeResume({ custom: [{ title: '荣誉', body: '' }] })
    expect(isResumeEmpty(titleOnly)).toBe(true)
  })
})
