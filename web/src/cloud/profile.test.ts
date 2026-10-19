import { describe, expect, it } from 'vitest'
import { cleanDisplayName, defaultDisplayName, displayInitial } from './profile'

describe('defaultDisplayName', () => {
  it('取邮箱 @ 前的部分', () => {
    expect(defaultDisplayName('xiaoming.li@outlook.com')).toBe('xiaoming.li')
  })

  it('空邮箱回退为默认称呼', () => {
    expect(defaultDisplayName('   ')).toBe('ShowMe 用户')
    expect(defaultDisplayName('@example.com')).toBe('ShowMe 用户')
  })
})

describe('displayInitial', () => {
  it('优先取昵称首字（支持中文与 emoji）', () => {
    expect(displayInitial('李小明', 'a@b.com')).toBe('李')
    expect(displayInitial('', 'alex@b.com')).toBe('A')
    expect(displayInitial('🚀 简历', '')).toBe('🚀')
  })

  it('昵称与邮箱都为空也能给出兜底首字', () => {
    expect(displayInitial('', '')).toBe('S')
  })
})

describe('cleanDisplayName', () => {
  it('去空白、折叠空格并限制长度', () => {
    expect(cleanDisplayName('  李小  明  ')).toBe('李小 明')
    expect(cleanDisplayName('a'.repeat(100)).length).toBe(40)
  })
})
