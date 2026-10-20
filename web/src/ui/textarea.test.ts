import { describe, expect, it } from 'vitest'
import { insertBulletAt } from './textarea'

describe('insertBulletAt', () => {
  it('空文本直接插入圆点', () => {
    expect(insertBulletAt('', 0, 0)).toEqual({ text: '- ', caret: 2 })
  })

  it('行中插入时自动补换行', () => {
    expect(insertBulletAt('负责项目', 2, 2)).toEqual({ text: '负责\n- 项目', caret: 5 })
  })

  it('行首或换行后不补换行', () => {
    expect(insertBulletAt('第一行\n', 4, 4)).toEqual({ text: '第一行\n- ', caret: 6 })
  })

  it('替换选中文字', () => {
    expect(insertBulletAt('做了一件事', 0, 2)).toEqual({ text: '- 一件事', caret: 2 })
  })
})
