import { describe, expect, it } from 'vitest'
import { emptyResume, sampleResume, type Resume } from '../model/resume'
import { decideMerge } from './merge'

function mine(name = '张三'): Resume {
  const r = emptyResume()
  r.basics.name = name
  r.basics.title = '工程师'
  return r
}

/** 深层键序打乱：jsonb 不保证键序 */
function shuffled(r: Resume): Resume {
  const { skills, projects, work, education, basics, version } = r
  const b = basics
  return {
    skills,
    projects,
    work,
    education,
    basics: { summary: b.summary, city: b.city, email: b.email, phone: b.phone, title: b.title, name: b.name },
    version,
  } as Resume
}

const T1 = '2026-10-15T10:00:00.000Z'
const T2 = '2026-10-15T11:00:00.000Z'

describe('decideMerge', () => {
  it('云端无数据 → push', () => {
    expect(decideMerge(mine(), null, null)).toBe('push')
  })

  it('内容一致（键序不同）→ align', () => {
    const r = mine()
    expect(decideMerge(r, null, { data: shuffled(r), updatedAt: T1 })).toBe('align')
  })

  it('本机仍是示例简历 → pull', () => {
    expect(decideMerge(sampleResume(), null, { data: mine(), updatedAt: T1 })).toBe('pull')
  })

  it('本机为空简历 → pull', () => {
    expect(decideMerge(emptyResume(), null, { data: mine(), updatedAt: T1 })).toBe('pull')
  })

  it('本机自上次同步未改、云端已改 → pull', () => {
    const base = mine('旧')
    expect(decideMerge(base, { data: base, at: T1 }, { data: mine('新'), updatedAt: T2 })).toBe('pull')
  })

  it('云端自上次同步未改、本机已改 → push', () => {
    const base = mine('旧')
    expect(decideMerge(mine('本机改'), { data: base, at: T1 }, { data: base, updatedAt: T1 })).toBe('push')
  })

  it('两边都改了 → conflict', () => {
    const base = mine('旧')
    expect(decideMerge(mine('本机改'), { data: base, at: T1 }, { data: mine('云端改'), updatedAt: T2 })).toBe('conflict')
  })

  it('无快照且内容不同 → conflict', () => {
    expect(decideMerge(mine('甲'), null, { data: mine('乙'), updatedAt: T1 })).toBe('conflict')
  })
})
