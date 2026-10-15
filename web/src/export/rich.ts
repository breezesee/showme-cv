/**
 * 多行文本解析：与模板运行时（templates/runtime.js 的 SM.rich）同一套规则，
 * 供 Word 等导出格式复用——回车换行、空行分段、圆点列表。
 */

/** 圆点行标记：• · ● ▪ ◦ 或 -/*（但 -数字 不是），标记后的空白一并去掉 */
const BULLET = /^\s*(?:[•·●▪◦]|[-*](?!\d))\s*/

export interface RichPara {
  kind: 'para'
  text: string
  /** 前面有空行（分段），渲染时可加段间距 */
  gap: boolean
}

export interface RichBullets {
  kind: 'bullets'
  items: string[]
  gap: boolean
}

export type RichBlock = RichPara | RichBullets

export function parseRich(text: string): RichBlock[] {
  const rows = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: RichBlock[] = []
  let bullets: string[] | null = null
  let bulletsGap = false
  let gap = false
  let any = false

  const flush = (): void => {
    // 圆点组的 gap 在组首行时定格，组内后续行不再改变它；flush 本身不改 gap
    if (bullets) blocks.push({ kind: 'bullets', items: bullets, gap: bulletsGap })
    bullets = null
  }

  for (const raw of rows) {
    const row = raw.replace(/\s+$/, '')
    if (!row.trim()) {
      // 空行：结束当前圆点组；只有已有内容时才让下一块带 gap
      flush()
      gap = any
      continue
    }
    const m = BULLET.exec(row)
    if (m) {
      const body = row.slice(m[0].length)
      if (!body) continue
      if (!bullets) {
        bullets = []
        bulletsGap = gap
      }
      bullets.push(body)
    } else {
      flush()
      blocks.push({ kind: 'para', text: row, gap })
    }
    gap = false
    any = true
  }
  flush()
  return blocks
}
