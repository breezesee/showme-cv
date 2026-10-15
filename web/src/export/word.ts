/**
 * Word 导出：用 docx 库生成真正可编辑的 .docx。
 * 统一简洁专业排版（与具体模板/主题无关）：居中姓名标题 + 一行联系方式 + 带下划线的分节标题 + 条目与圆点。
 * 多行文本复用 parseRich（与模板运行时同一套「回车换行、空行分段、- 圆点」规则）。
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
  type IParagraphOptions,
} from 'docx'
import type { Resume } from '../model/resume'
import { downloadBlob, exportFileName } from './download'
import { parseRich, type RichBlock } from './rich'

const INK = '222226'
const MUTED = '77777D'
const RULE = 'D9D9DE'
/** A4 内容宽度：210mm - 左右各 22mm 页边距 */
const CONTENT_TWIPS = convertMillimetersToTwip(210 - 22 * 2)

/** 与模板运行时 SM.period 一致：起止期间用 – 连接 */
function period(a: string, b: string): string {
  const has = (s: string) => s.trim() !== ''
  if (has(a) && has(b)) return `${a.trim()} – ${b.trim()}`
  return has(a) ? a.trim() : b.trim()
}

/** 条目抬头：左标题 + 右对齐日期（制表位推到内容区右缘） */
function entryHead(head: string, date: string): Paragraph {
  const children: [TextRun, TextRun] = [
    new TextRun({ text: head, bold: true, size: 21, color: INK }),
    new TextRun({ children: [new Tab(), date], size: 18, color: MUTED }),
  ]
  return new Paragraph({
    children,
    keepNext: true,
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_TWIPS }],
    spacing: { before: 120, after: 40 },
  })
}

function sectionTitle(title: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 24, color: INK })],
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 2 } },
    spacing: { before: 280, after: 120 },
  })
}

function richParagraphs(blocks: RichBlock[]): Paragraph[] {
  return blocks.map((b) => {
    const options: IParagraphOptions =
      b.kind === 'bullets'
        ? { children: b.items.map((t) => new TextRun({ text: t, size: 21, color: INK })), bullet: { level: 0 } }
        : { children: [new TextRun({ text: b.text, size: 21, color: INK })] }
    return new Paragraph({ ...options, spacing: { before: b.gap ? 120 : 0, after: 40, line: 300 } })
  })
}

/** 多行字段直接转段落/圆点（空文本返回空数组） */
function richField(text: string): Paragraph[] {
  return text.trim() ? richParagraphs(parseRich(text)) : []
}

/** 每项一条的列表（工作亮点），剥掉用户自己输入的圆点前缀（与 SM.list 一致） */
function bulletList(items: string[]): Paragraph[] {
  const cleaned = items.map((s) => s.replace(/^\s*(?:[•·●▪◦]|[-*](?!\d))\s*/, '')).filter((s) => s.trim() !== '')
  return richParagraphs(cleaned.length ? [{ kind: 'bullets', items: cleaned, gap: false }] : [])
}

export function buildWordDocument(resume: Resume): Document {
  const { basics, education, work, projects, skills } = resume
  const has = (s: string) => s.trim() !== ''
  const body: Paragraph[] = []

  if (has(basics.name)) {
    body.push(new Paragraph({
      children: [new TextRun({ text: basics.name.trim(), bold: true, size: 44, color: INK })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }))
  }
  if (has(basics.title)) {
    body.push(new Paragraph({
      children: [new TextRun({ text: basics.title.trim(), size: 22, color: MUTED })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }))
  }
  const contacts = [basics.city, basics.phone, basics.email].filter(has).join(' · ')
  if (contacts) {
    body.push(new Paragraph({
      children: [new TextRun({ text: contacts, size: 18, color: MUTED })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }))
  }

  const summary = richField(basics.summary)
  if (summary.length) body.push(sectionTitle('自我评价'), ...summary)

  const edu = education.flatMap((e) => {
    let head = e.school.trim()
    if (has(e.major)) head += ` · ${e.major.trim()}`
    if (has(e.degree)) head += `（${e.degree.trim()}）`
    if (!head) return []
    return [entryHead(head, period(e.start, e.end)), ...richField(e.notes)]
  })
  if (edu.length) body.push(sectionTitle('教育经历'), ...edu)

  const jobs = work.flatMap((w) => {
    let head = w.company.trim()
    if (has(w.position)) head += ` · ${w.position.trim()}`
    if (!head) return []
    return [entryHead(head, period(w.start, w.end)), ...richField(w.description), ...bulletList(w.highlights)]
  })
  if (jobs.length) body.push(sectionTitle('工作经历'), ...jobs)

  const proj = projects.flatMap((p) => {
    let head = p.name.trim()
    if (has(p.role)) head += ` · ${p.role.trim()}`
    if (!head) return []
    return [entryHead(head, period(p.start, p.end)), ...richField(p.description)]
  })
  if (proj.length) body.push(sectionTitle('项目经历'), ...proj)

  const skillRows = skills
    .map((g) => {
      const items = g.items.filter(has).join('、')
      if (!has(g.category) && !items) return null
      return new Paragraph({
        children: [
          new TextRun({ text: g.category.trim(), size: 21, color: MUTED }),
          ...(has(g.category) && items ? [new TextRun({ text: '  ', size: 21 })] : []),
          ...(items ? [new TextRun({ text: items, size: 21, color: INK })] : []),
        ],
        spacing: { after: 40, line: 300 },
      })
    })
    .filter((p) => p !== null)
  if (skillRows.length) body.push(sectionTitle('技能'), ...skillRows)

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
          margin: { top: convertMillimetersToTwip(20), bottom: convertMillimetersToTwip(20), left: convertMillimetersToTwip(22), right: convertMillimetersToTwip(22) },
        },
      },
      children: body,
    }],
  })
}

export async function buildWordBlob(resume: Resume): Promise<Blob> {
  return Packer.toBlob(buildWordDocument(resume))
}

export async function exportResumeWord(resume: Resume): Promise<void> {
  const blob = await buildWordBlob(resume)
  downloadBlob(blob, exportFileName(resume, 'docx'))
}
