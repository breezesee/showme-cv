import { describe, expect, it } from 'vitest'
import {
  customSectionId,
  defaultLayout,
  defaultOrder,
  insertCustomSection,
  moveSection,
  reconcileLayout,
  SECTION_TITLES,
  toggleSectionHidden,
  visibleSectionIds,
} from './layout'
import type { ResumeLayout } from './resume'

const A = customSectionId('a')
const B = customSectionId('b')

describe('默认布局', () => {
  it('固定板块顺序，自定义模块在自我评价之前', () => {
    expect(defaultOrder([])).toEqual(['education', 'work', 'projects', 'skills', 'summary'])
    expect(defaultOrder(['a', 'b'])).toEqual([
      'education',
      'work',
      'projects',
      'skills',
      A,
      B,
      'summary',
    ])
    expect(defaultLayout(['a']).hidden).toEqual([])
  })

  it('固定板块标题完整', () => {
    expect(SECTION_TITLES).toEqual({
      education: '教育经历',
      work: '工作经历',
      projects: '项目经历',
      skills: '技能',
      summary: '自我评价',
    })
  })
})

describe('reconcileLayout', () => {
  it('缺失或非法布局回到默认', () => {
    expect(reconcileLayout(undefined, ['a'])).toEqual({ order: defaultOrder(['a']), hidden: [] })
    expect(reconcileLayout('x', [])).toEqual({ order: defaultOrder([]), hidden: [] })
    expect(reconcileLayout({ order: 'x', hidden: 'y' }, [])).toEqual({
      order: defaultOrder([]),
      hidden: [],
    })
  })

  it('过滤未知与重复 id，并补齐缺失板块', () => {
    const layout = reconcileLayout(
      { order: ['work', A, 'work', 'nope'], hidden: ['projects', 'nope', 'projects'] },
      ['a', 'b'],
    )
    expect(layout.order).toEqual(['work', A, 'education', 'projects', 'skills', B, 'summary'])
    expect(layout.hidden).toEqual(['projects'])
  })

  it('自定义模块可被隐藏', () => {
    expect(reconcileLayout({ order: [A], hidden: [A] }, ['a']).hidden).toEqual([A])
  })
})

describe('板块操作', () => {
  it('切换隐藏：加入后再移除', () => {
    const layout = defaultLayout([])
    toggleSectionHidden(layout, 'projects')
    expect(layout.hidden).toEqual(['projects'])
    toggleSectionHidden(layout, 'projects')
    expect(layout.hidden).toEqual([])
  })

  it('移动板块：越界不动，正常交换', () => {
    const layout = defaultLayout([])
    moveSection(layout, 'work', -1)
    expect(layout.order.slice(0, 2)).toEqual(['work', 'education'])
    moveSection(layout, 'work', -1)
    expect(layout.order[0]).toBe('work')
    moveSection(layout, 'summary', 1)
    expect(layout.order.at(-1)).toBe('summary')
  })

  it('新自定义模块插入到自我评价前，重复插入无副作用', () => {
    const layout = defaultLayout([])
    insertCustomSection(layout, 'a')
    expect(layout.order.at(-2)).toBe(A)
    expect(layout.order.at(-1)).toBe('summary')
    insertCustomSection(layout, 'a')
    expect(layout.order.filter((id) => id === A)).toHaveLength(1)
  })

  it('没有自我评价时追加到末尾', () => {
    const layout: ResumeLayout = { order: ['education'], hidden: [] }
    insertCustomSection(layout, 'a')
    expect(layout.order).toEqual(['education', A])
  })
})

describe('visibleSectionIds', () => {
  it('过滤隐藏与未知项，按 order 输出并补齐缺失板块', () => {
    const layout = reconcileLayout({ order: ['work', A, 'custom:missing'], hidden: ['projects', A] }, ['a', 'b'])
    expect(visibleSectionIds(layout, ['a', 'b'])).toEqual(['work', 'education', 'skills', B, 'summary'])
  })

  it('自定义模块不存在时不输出', () => {
    expect(visibleSectionIds(defaultLayout([]), [])).toEqual(['education', 'work', 'projects', 'skills', 'summary'])
  })
})
