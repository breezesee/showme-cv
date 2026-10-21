import { describe, expect, it } from 'vitest'
import { emptyResume, sampleResume } from '../model/resume'
import { cleanResumeName, MAX_RESUME_NAME, suggestCopyName, suggestResumeName } from './resumeName'

const basics = (name: string, title: string) => {
  const r = emptyResume()
  r.basics.name = name
  r.basics.title = title
  return r
}

/** 2026-10-19（月份从 0 开始） */
const OCT_19 = new Date(2026, 9, 19, 10, 0)

describe('cleanResumeName', () => {
  it('去首尾空白并把连续空白折叠为一个空格', () => {
    expect(cleanResumeName('  李明  的 简历  ')).toBe('李明 的 简历')
  })

  it('超长名称截断到上限', () => {
    expect(cleanResumeName('a'.repeat(100)).length).toBe(MAX_RESUME_NAME)
  })
})

describe('suggestResumeName', () => {
  it('姓名 + 求职意向 → 姓名-意向', () => {
    expect(suggestResumeName(basics('李小明', '产品经理'), [], OCT_19)).toBe('李小明-产品经理')
  })

  it('只有姓名 → 姓名', () => {
    expect(suggestResumeName(basics('李小明', ''), [], OCT_19)).toBe('李小明')
  })

  it('只有求职意向 → 意向简历', () => {
    expect(suggestResumeName(basics('', '产品经理'), [], OCT_19)).toBe('产品经理简历')
  })

  it('都为空 → 我的简历 + 日期', () => {
    expect(suggestResumeName(emptyResume(), [], OCT_19)).toBe('我的简历 10-19')
  })

  it('示例简历生成有意义名称', () => {
    expect(suggestResumeName(sampleResume(), [], OCT_19)).toBe('李小明-产品经理')
  })

  it('重名时追加（2）（3）', () => {
    const r = basics('李小明', '产品经理')
    expect(suggestResumeName(r, ['李小明-产品经理'], OCT_19)).toBe('李小明-产品经理（2）')
    expect(suggestResumeName(r, ['李小明-产品经理', '李小明-产品经理（2）'], OCT_19)).toBe('李小明-产品经理（3）')
  })

  it('大小写与空白差异同样视为重名', () => {
    const r = basics('Alex', 'PM')
    expect(suggestResumeName(r, ['  alex-pm '], OCT_19)).toBe('Alex-PM（2）')
  })

  it('追加后缀后仍不超过长度上限', () => {
    const base = 'a'.repeat(MAX_RESUME_NAME)
    const got = suggestResumeName(basics(base, ''), [base], OCT_19)
    expect(got.length).toBeLessThanOrEqual(MAX_RESUME_NAME)
    expect(got.endsWith('（2）')).toBe(true)
  })
})

describe('suggestCopyName', () => {
  it('追加「（副本）」，重名时递增编号', () => {
    expect(suggestCopyName('李小明-产品经理', [])).toBe('李小明-产品经理（副本）')
    expect(suggestCopyName('李小明-产品经理', ['李小明-产品经理（副本）'])).toBe('李小明-产品经理（副本 2）')
    expect(
      suggestCopyName('李小明-产品经理', ['李小明-产品经理（副本）', '李小明-产品经理（副本 2）']),
    ).toBe('李小明-产品经理（副本 3）')
  })

  it('已有副本后缀时继续递增，而不是叠加', () => {
    expect(suggestCopyName('李小明（副本）', [])).toBe('李小明（副本 2）')
    expect(suggestCopyName('李小明（副本 2）', ['李小明（副本 2）'])).toBe('李小明（副本 3）')
  })

  it('空名称回退为「我的简历」，并遵守长度上限', () => {
    expect(suggestCopyName('  ', [])).toBe('我的简历（副本）')
    const base = 'a'.repeat(MAX_RESUME_NAME)
    const got = suggestCopyName(base, [])
    expect(got.length).toBeLessThanOrEqual(MAX_RESUME_NAME)
    expect(got.endsWith('（副本）')).toBe(true)
  })
})
