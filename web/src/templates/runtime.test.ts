import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

/** 在独立上下文的假 window 上执行模板运行时，只测与 DOM 无关的文本工具 */
interface SMText {
  esc(s: unknown): string
  rich(text: string, cls?: string): string
  list(arr: string[], cls?: string): string
  link(value: unknown): string
  extras(basics: unknown): { label: string; html: string }[]
  sectionIds(data: unknown): string[]
  customSection(data: unknown, id: string): { id: string; title: string; body: string } | null
  photo(url: unknown, cls?: string): string
}
const source = readFileSync(new URL('../../templates/runtime.js', import.meta.url), 'utf8')
const win: { SM?: SMText } = {}
runInNewContext(source, { window: win })
const SM = win.SM!

describe('模板运行时：多行文本', () => {
  it('回车换行：每行一个段落', () => {
    expect(SM.rich('第一行\n第二行')).toBe(
      '<div class="rt"><p class="rt-p" data-u>第一行</p><p class="rt-p" data-u>第二行</p></div>',
    )
  })

  it('空行分段：下一段带间距，连续空行只算一次', () => {
    expect(SM.rich('甲\r\n\r\n\n乙')).toBe(
      '<div class="rt"><p class="rt-p" data-u>甲</p><p class="rt-p rt-gap" data-u>乙</p></div>',
    )
  })

  it('以 - • 开头的行显示为圆点，负数不算圆点', () => {
    expect(SM.rich('职责：\n- 负责 A\n• 负责 B\n-5% 成本', 'muted')).toBe(
      '<div class="rt muted"><p class="rt-p" data-u>职责：</p>' +
        '<ul class="rt-ul"><li data-u>负责 A</li><li data-u>负责 B</li></ul>' +
        '<p class="rt-p" data-u>-5% 成本</p></div>',
    )
  })

  it('空白内容返回空串；内容被转义', () => {
    expect(SM.rich('  \n\n ')).toBe('')
    expect(SM.rich('<b>&</b>')).toBe('<div class="rt"><p class="rt-p" data-u>&lt;b&gt;&amp;&lt;/b&gt;</p></div>')
  })

  it('亮点列表去掉用户输入的圆点前缀并跳过空行', () => {
    expect(SM.list(['- 甲', '', '• 乙'], 'bullets')).toBe(
      '<ul class="rt-ul bullets"><li data-u>甲</li><li data-u>乙</li></ul>',
    )
    expect(SM.list([])).toBe('')
  })
})

describe('模板运行时：附加信息与板块布局', () => {
  it('仅 http(s) 渲染为安全链接，其余按纯文本转义', () => {
    expect(SM.link('https://example.com/a?b=1&c=2')).toBe(
      '<a class="rt-link" href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a>',
    )
    expect(SM.link(' javascript:alert(1) ')).toBe('javascript:alert(1)')
    expect(SM.link('<b>微信</b>')).toBe('&lt;b&gt;微信&lt;/b&gt;')
  })

  it('附加项丢弃空值，标签可空', () => {
    expect(SM.extras({ extras: [
      { label: '微信', value: 'showme' },
      { label: '', value: 'https://example.com' },
      { label: '空', value: '  ' },
    ] })).toEqual([
      { label: '微信', html: '微信：showme' },
      { label: '', html: '<a class="rt-link" href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>' },
    ])
    expect(SM.extras(undefined)).toEqual([])
  })

  it('按 layout 顺序返回可见板块，缺失项补默认顺序', () => {
    const data = {
      custom: [{ id: 'awards' }],
      layout: { order: ['work', 'custom:awards', 'nope'], hidden: ['projects'] },
    }
    expect(SM.sectionIds(data)).toEqual(['work', 'custom:awards', 'education', 'skills', 'summary'])
    expect(SM.sectionIds({})).toEqual(['education', 'work', 'projects', 'skills', 'summary'])
  })

  it('自定义模块按 id 查找', () => {
    const data = { custom: [{ id: 'awards', title: '荣誉', body: '一等奖' }] }
    expect(SM.customSection(data, 'custom:awards')?.title).toBe('荣誉')
    expect(SM.customSection(data, 'custom:missing')).toBeNull()
    expect(SM.customSection(data, 'work')).toBeNull()
  })

  it('照片：无地址不输出，地址转义，加载失败时移除图片', () => {
    expect(SM.photo('')).toBe('')
    expect(SM.photo(undefined)).toBe('')
    expect(SM.photo('https://x.test/a.jpg?b=1&c=2', 'side-photo')).toBe(
      '<img class="r-photo side-photo" src="https://x.test/a.jpg?b=1&amp;c=2" alt="" onerror="this.remove()">',
    )
  })
})
