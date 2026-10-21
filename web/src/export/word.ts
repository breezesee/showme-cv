/**
 * Word 导出：用 docx 库生成真正可编辑的 .docx。
 * 统一简洁专业排版（与具体模板/主题无关）：居中姓名标题 + 一行联系方式 + 带下划线的分节标题 + 条目与圆点。
 * 多行文本复用 parseRich（与模板运行时同一套「回车换行、空行分段、- 圆点」规则）。
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  Tab,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx'
import { photoPublicUrl } from '../cloud/client'
import { SECTION_TITLES, customSectionId, visibleSectionIds } from '../model/layout'
import type { Basics, Resume, SectionId } from '../model/resume'
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
  return blocks.flatMap((b) => {
    if (b.kind === 'bullets') {
      return b.items.map((text, i) => new Paragraph({
        children: [new TextRun({ text, size: 21, color: INK })],
        bullet: { level: 0 },
        spacing: { before: b.gap && i === 0 ? 120 : 0, after: 40, line: 300 },
      }))
    }
    return [new Paragraph({
      children: [new TextRun({ text: b.text, size: 21, color: INK })],
      spacing: { before: b.gap ? 120 : 0, after: 40, line: 300 },
    })]
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

/** 联系方式一行：城市、电话、邮箱，再接非空附加项（标签：值，纯文本） */
function contactLine(basics: Basics): string {
  const has = (s: string) => s.trim() !== ''
  const extras = basics.extras
    .filter((e) => e.value.trim() !== '')
    .map((e) => (has(e.label) ? `${e.label.trim()}：` : '') + e.value.trim())
  return [basics.city, basics.phone, basics.email]
    .filter(has)
    .map((s) => s.trim())
    .concat(extras)
    .join(' · ')
}

/** 单个板块的段落；无内容返回空数组（不输出分节标题） */
function sectionBody(id: SectionId, resume: Resume): Paragraph[] {
  const { basics, education, work, projects, skills } = resume
  const has = (s: string) => s.trim() !== ''

  switch (id) {
    case 'education': {
      const rows = education.flatMap((e) => {
        let head = e.school.trim()
        if (has(e.major)) head += ` · ${e.major.trim()}`
        if (has(e.degree)) head += `（${e.degree.trim()}）`
        if (!head) return []
        return [entryHead(head, period(e.start, e.end)), ...richField(e.notes)]
      })
      return rows.length ? [sectionTitle(SECTION_TITLES.education), ...rows] : []
    }
    case 'work': {
      const rows = work.flatMap((w) => {
        let head = w.company.trim()
        if (has(w.position)) head += ` · ${w.position.trim()}`
        if (!head) return []
        return [entryHead(head, period(w.start, w.end)), ...richField(w.description), ...bulletList(w.highlights)]
      })
      return rows.length ? [sectionTitle(SECTION_TITLES.work), ...rows] : []
    }
    case 'projects': {
      const rows = projects.flatMap((p) => {
        let head = p.name.trim()
        if (has(p.role)) head += ` · ${p.role.trim()}`
        if (!head) return []
        return [entryHead(head, period(p.start, p.end)), ...richField(p.description)]
      })
      return rows.length ? [sectionTitle(SECTION_TITLES.projects), ...rows] : []
    }
    case 'skills': {
      const rows = skills
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
      return rows.length ? [sectionTitle(SECTION_TITLES.skills), ...rows] : []
    }
    case 'summary': {
      const rows = richField(basics.summary)
      return rows.length ? [sectionTitle(SECTION_TITLES.summary), ...rows] : []
    }
    default: {
      const custom = resume.custom.find((c) => customSectionId(c.id) === id)
      if (!custom) return []
      const rows = richField(custom.body)
      if (!rows.length) return []
      const title = custom.title.trim()
      return [...(title ? [sectionTitle(title)] : []), ...rows]
    }
  }
}

export interface WordPhoto {
  data: Uint8Array
  type: 'jpg' | 'png'
}

/** 页头文字：有照片时左对齐放进表格左列，无照片时居中 */
function headerParagraphs(basics: Basics, contacts: string, centered: boolean): Paragraph[] {
  const has = (s: string) => s.trim() !== ''
  const rows: Paragraph[] = []
  if (has(basics.name)) {
    rows.push(new Paragraph({
      children: [new TextRun({ text: basics.name.trim(), bold: true, size: 44, color: INK })],
      ...(centered ? { alignment: AlignmentType.CENTER } : {}),
      spacing: { after: 60 },
    }))
  }
  if (has(basics.title)) {
    rows.push(new Paragraph({
      children: [new TextRun({ text: basics.title.trim(), size: 22, color: MUTED })],
      ...(centered ? { alignment: AlignmentType.CENTER } : {}),
      spacing: { after: 40 },
    }))
  }
  if (contacts) {
    rows.push(new Paragraph({
      children: [new TextRun({ text: contacts, size: 18, color: MUTED })],
      ...(centered ? { alignment: AlignmentType.CENTER } : {}),
      spacing: { after: centered ? 200 : 0 },
    }))
  }
  return rows
}

/** 有照片的页头：无边框两列表格，右侧 25×35mm 图片 */
function headerTable(basics: Basics, contacts: string, photo: WordPhoto): Table {
  const photoWidth = convertMillimetersToTwip(25)
  const textWidth = CONTENT_TWIPS - photoWidth - convertMillimetersToTwip(4)
  const noMargin = { top: 0, bottom: 0, left: 0, right: 0 }
  const text = headerParagraphs(basics, contacts, false)
  return new Table({
    width: { size: CONTENT_TWIPS, type: WidthType.DXA },
    columnWidths: [textWidth, photoWidth],
    borders: TableBorders.NONE,
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: textWidth, type: WidthType.DXA },
          margins: noMargin,
          verticalAlign: VerticalAlign.CENTER,
          children: text.length ? text : [new Paragraph('')],
        }),
        new TableCell({
          width: { size: photoWidth, type: WidthType.DXA },
          margins: noMargin,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 0 },
            children: [new ImageRun({
              data: photo.data,
              transformation: { width: 95, height: 133 },
              type: photo.type,
            })],
          })],
        }),
      ],
    })],
  })
}

export function buildWordDocument(resume: Resume, photo?: WordPhoto): Document {
  const { basics } = resume
  const contacts = contactLine(basics)
  const body: (Paragraph | Table)[] = []

  if (photo) body.push(headerTable(basics, contacts, photo))
  else body.push(...headerParagraphs(basics, contacts, true))

  const customIds = resume.custom.map((c) => c.id)
  for (const id of visibleSectionIds(resume.layout, customIds)) {
    body.push(...sectionBody(id, resume))
  }

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

/** 导出前抓取照片；网络或对象不存在时按无照片导出 */
async function loadResumePhoto(resume: Resume): Promise<WordPhoto | undefined> {
  const url = photoPublicUrl(resume.basics.photo)
  if (!url) return undefined
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      type: /^(?:data:image\/png|.*\.png(?:$|\?))/i.test(resume.basics.photo) ? 'png' : 'jpg',
    }
  } catch {
    return undefined
  }
}

export async function buildWordBlob(resume: Resume, photo?: WordPhoto): Promise<Blob> {
  const image = photo ?? await loadResumePhoto(resume)
  return Packer.toBlob(buildWordDocument(resume, image))
}

export async function exportResumeWord(resume: Resume): Promise<void> {
  const blob = await buildWordBlob(resume)
  downloadBlob(blob, exportFileName(resume, 'docx'))
}
