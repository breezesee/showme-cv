/** 在光标处插入一个要点前缀；行中插入时自动补换行，行首不重复补 */
export function insertBulletAt(
  text: string,
  start: number,
  end: number,
): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  const before = text.slice(0, from)
  const prefix = before === '' || before.endsWith('\n') ? '' : '\n'
  const insert = `${prefix}- `
  return {
    text: before + insert + text.slice(to),
    caret: from + insert.length,
  }
}
