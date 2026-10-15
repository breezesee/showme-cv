import { describe, expect, it } from 'vitest'
import { parseRich } from './rich'

/**
 * 与模板运行时（templates/runtime.js 的 SM.rich）同一套规则：
 * 回车换行、空行分段、- • · ● ▪ ◦ / -* 开头为圆点、-*数字 不是圆点。
 */
describe('parseRich', () => {
  it('回车换行：每行一个段落', () => {
    expect(parseRich('第一行\n第二行')).toEqual([
      { kind: 'para', text: '第一行', gap: false },
      { kind: 'para', text: '第二行', gap: false },
    ])
  })

  it('\\r\\n 与 \\r 都归一为换行', () => {
    expect(parseRich('a\r\nb\rc')).toEqual([
      { kind: 'para', text: 'a', gap: false },
      { kind: 'para', text: 'b', gap: false },
      { kind: 'para', text: 'c', gap: false },
    ])
  })

  it('空行分段：下一个块带 gap', () => {
    expect(parseRich('a\n\nb')).toEqual([
      { kind: 'para', text: 'a', gap: false },
      { kind: 'para', text: 'b', gap: true },
    ])
  })

  it('开头的空行不产生 gap', () => {
    expect(parseRich('\n\na')).toEqual([{ kind: 'para', text: 'a', gap: false }])
  })

  it('连续圆点行合并为一组', () => {
    expect(parseRich('- 亮点一\n- 亮点二\n• 亮点三')).toEqual([
      { kind: 'bullets', items: ['亮点一', '亮点二', '亮点三'], gap: false },
    ])
  })

  it('-数字 不是圆点，保持为段落', () => {
    expect(parseRich('-1 分')).toEqual([{ kind: 'para', text: '-1 分', gap: false }])
  })

  it('圆点行为空时跳过，不影响前后', () => {
    expect(parseRich('-\n- a')).toEqual([{ kind: 'bullets', items: ['a'], gap: false }])
  })

  it('空行把圆点组拆开，第二组带 gap', () => {
    expect(parseRich('- a\n\n- b')).toEqual([
      { kind: 'bullets', items: ['a'], gap: false },
      { kind: 'bullets', items: ['b'], gap: true },
    ])
  })

  it('段落与圆点交替、各段 gap 正确', () => {
    expect(parseRich('概览\n\n- 亮点一\n- 亮点二\n\n结语')).toEqual([
      { kind: 'para', text: '概览', gap: false },
      { kind: 'bullets', items: ['亮点一', '亮点二'], gap: true },
      { kind: 'para', text: '结语', gap: true },
    ])
  })

  it('去掉行尾空白，纯空白行视为空行', () => {
    expect(parseRich('a  \n   \nb')).toEqual([
      { kind: 'para', text: 'a', gap: false },
      { kind: 'para', text: 'b', gap: true },
    ])
  })

  it('空文本与全空白返回空数组', () => {
    expect(parseRich('')).toEqual([])
    expect(parseRich('  \n \n')).toEqual([])
  })
})
