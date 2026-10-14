import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

/** 在独立上下文的假 window 上执行模板运行时，只测与 DOM 无关的文本工具 */
interface SMText {
  esc(s: unknown): string
  rich(text: string, cls?: string): string
  list(arr: string[], cls?: string): string
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
