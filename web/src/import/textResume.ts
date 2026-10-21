import { normalizeMonth } from '../model/date'
import { defaultLayout } from '../model/layout'
import {
  emptyResume,
  newSectionId,
  type Basics,
  type Education,
  type Project,
  type Resume,
  type SkillGroup,
  type Work,
} from '../model/resume'

/** 粘贴文本导入：把常见纯文本简历解析为结构化数据，识别不了的原文尽量保留为描述 */

export interface ParseStats {
  basics: boolean
  education: number
  work: number
  projects: number
  skills: number
  custom: number
}

export interface ParsedResumeText {
  resume: Resume
  stats: ParseStats
}

type SectionKind =
  | 'preamble'
  | 'basics'
  | 'education'
  | 'work'
  | 'projects'
  | 'skills'
  | 'summary'
  | 'custom'

interface RawSection {
  kind: SectionKind
  title: string
  lines: string[]
}

const BULLET_RE = /^[-•*·]\s*(.+)$/
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE_RE = /(?:\+?86[-\s]?)?(?:1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}|0\d{2,3}[-\s]?\d{7,8})/
const LABEL_RE =
  /^(姓名|名字|求职意向|意向岗位|目标职位|应聘职位|职位|电话|手机号码|手机号|手机|邮箱地址|电子邮箱|电子邮件|邮箱|E-?mail|所在城市|现居地|现居|所在地|城市)\s*[：:]\s*(.+)$/i
const DEGREE_RE = /^(本科|硕士|博士|研究生|大专|专科|高中|中专|学士|MBA|EMBA|Bachelor(?:'s)?|Master(?:'s)?|PhD|Ph\.D\.?)$/i

const SECTION_ALIASES: Record<string, Exclude<SectionKind, 'preamble' | 'custom'>> = {
  基本信息: 'basics',
  个人信息: 'basics',
  基本资料: 'basics',
  个人资料: 'basics',
  联系方式: 'basics',
  教育经历: 'education',
  教育背景: 'education',
  学习经历: 'education',
  学历教育: 'education',
  工作经历: 'work',
  工作经验: 'work',
  工作履历: 'work',
  职业经历: 'work',
  项目经历: 'projects',
  项目经验: 'projects',
  项目: 'projects',
  技能: 'skills',
  专业技能: 'skills',
  技能清单: 'skills',
  技能特长: 'skills',
  自我评价: 'summary',
  个人总结: 'summary',
  个人简介: 'summary',
  自我介绍: 'summary',
  综合评价: 'summary',
  关于我: 'summary',
}

const CITY_RE =
  /^(?:北京|上海|天津|重庆|香港|澳门|台北|深圳|广州|杭州|南京|苏州|成都|武汉|西安|长沙|郑州|青岛|厦门|福州|合肥|宁波|无锡|济南|大连|沈阳|昆明|哈尔滨|长春|南昌|贵阳|南宁|海口|太原|石家庄|兰州|乌鲁木齐|呼和浩特|拉萨|银川|西宁|珠海|东莞|佛山|温州|嘉兴|南通|泉州|烟台|洛阳|常州|徐州|绍兴|中山|惠州|江门|汕头|潍坊|保定|廊坊|三亚|新加坡)(?:市|省|区)?$/

function cleanHeading(raw: string): string {
  let text = raw.trim().replace(/^#{1,6}\s*/, '')
  text = text.replace(/^第[一二三四五六七八九十\d]+[部分章节][、.．:：]?\s*/, '')
  text = text.replace(/^(?:[（(][一二三四五六七八九十]+[)）]|[一二三四五六七八九十]+[、.．])\s*/, '')
  text = text.replace(/^\d{1,2}[、.．)）]\s*/, '')
  text = text.replace(/[：:]\s*$/, '')
  return text.replace(/\s+/g, ' ').trim()
}

function detectHeading(raw: string): { kind: SectionKind; title: string } | null {
  if (!raw.trim()) return null
  const title = cleanHeading(raw)
  if (!title || title.length > 30) return null
  const key = title.replace(/\s+/g, '')
  const fixed = SECTION_ALIASES[key]
  if (fixed) return { kind: fixed, title }
  if (title.length <= 16 && !/^\d/.test(title)
    && (/荣誉|奖项|获奖|证书|^(?:其他|其它)/.test(title) || /(?:经历|经验)$/.test(title))) {
    return { kind: 'custom', title }
  }
  return null
}

function trimBlank(lines: readonly string[]): string[] {
  let start = 0
  let end = lines.length
  while (start < end && !lines[start]!.trim()) start++
  while (end > start && !lines[end - 1]!.trim()) end--
  return lines.slice(start, end)
}

function splitBlocks(lines: readonly string[]): string[][] {
  const blocks: string[][] = []
  let current: string[] = []
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) blocks.push(current)
      current = []
      continue
    }
    current.push(line.trim())
  }
  if (current.length) blocks.push(current)
  return blocks
}

function isName(value: string): boolean {
  if (/[\d@]/.test(value)) return false
  if (/^[\u4e00-\u9fa5·]{2,8}$/.test(value)) return true
  return /^[A-Za-z][A-Za-z.'’ -]{1,29}$/.test(value)
}

function assignLabeled(basics: Basics, rawKey: string, value: string): void {
  const key = rawKey.toLowerCase().replace(/\s+/g, '')
  if (key === '姓名' || key === '名字') basics.name = value
  else if (key === '求职意向' || key === '意向岗位' || key === '目标职位' || key === '应聘职位' || key === '职位') {
    basics.title = value
  } else if (key === '电话' || key === '手机' || key === '手机号' || key === '手机号码') basics.phone = value
  else if (key === '邮箱' || key === '电子邮箱' || key === '邮箱地址' || key === '电子邮件' || key === 'email') {
    basics.email = value
  } else if (key === '城市' || key === '现居' || key === '现居地' || key === '所在地' || key === '所在城市') {
    basics.city = value
  }
}

function applyBasics(lines: readonly string[], resume: Resume): void {
  const basics = resume.basics
  const firstContent = lines.find((line) => line.trim())?.trim() ?? ''
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const labeled = LABEL_RE.exec(line)
    if (labeled) {
      assignLabeled(basics, labeled[1]!, labeled[2]!.trim())
      continue
    }

    let rest = line
    const email = EMAIL_RE.exec(rest)
    if (email) {
      if (!basics.email) basics.email = email[0]
      rest = rest.replace(email[0], ' ')
    }
    const phone = PHONE_RE.exec(rest)
    if (phone) {
      if (!basics.phone) basics.phone = phone[0].trim()
      rest = rest.replace(phone[0], ' ')
    }

    // 「李小明 产品经理」这类首行用单个空格分隔的写法
    if (!basics.name && line === firstContent) {
      const pair = /^([\u4e00-\u9fa5·]{2,4})\s+([^|｜]{2,40})$/.exec(rest.trim())
      if (pair) {
        basics.name = pair[1]!
        if (!basics.title) basics.title = pair[2]!.trim()
        continue
      }
    }

    const segments = rest.split(/\s*[|｜]\s*|\s{2,}/).map((s) => s.trim()).filter(Boolean)
    for (const segment of segments) {
      if (!segment || EMAIL_RE.test(segment) || PHONE_RE.test(segment)) continue
      if (!basics.city && CITY_RE.test(segment)) {
        basics.city = segment
        continue
      }
      if (!basics.name && isName(segment)) {
        basics.name = segment
        continue
      }
      if (!basics.title && segment.length <= 40) basics.title = segment
    }
  }
}

const DATE_TOKEN =
  '(?:\\d{4}(?:\\s*[.\\-/年]\\s*\\d{1,2}\\s*月?(?:\\s*[.\\-/]\\s*\\d{1,2}\\s*日)?)?|至今|现在|今|present|now|current)'
const RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|~|～|至|到)\\s*(${DATE_TOKEN})`, 'i')

function cleanHeaderRest(value: string): string {
  return value
    .replace(/[（(【\[]\s*[)）】\]]/g, ' ')
    .replace(/[（(【\[]\s*$/, ' ')
    .replace(/^\s*[)）】\]]/, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|｜,，;；·•\-–—]+/, '')
    .replace(/[\s|｜,，;；·•\-–—]+$/, '')
    .trim()
}

function parseEntryHeader(line: string): { rest: string; start: string; end: string } {
  const range = RANGE_RE.exec(line)
  if (!range) return { rest: cleanHeaderRest(line), start: '', end: '' }
  const rest = cleanHeaderRest(line.slice(0, range.index) + ' ' + line.slice(range.index + range[0].length))
  return { rest, start: normalizeMonth(range[1]!), end: normalizeMonth(range[2]!) }
}

/** 兼容日期与标题分行书写：日期可在标题上一行或下一行 */
function parseEntryBlock(block: readonly string[]): { rest: string; start: string; end: string; body: string[] } {
  const first = parseEntryHeader(block[0]!)
  const second = block[1]
  if (first.start || first.end) {
    if (!first.rest && second && !BULLET_RE.test(second.trim())) {
      return { rest: cleanHeaderRest(second), start: first.start, end: first.end, body: block.slice(2) }
    }
    return { rest: first.rest, start: first.start, end: first.end, body: block.slice(1) }
  }
  if (first.rest && second) {
    const dateOnly = parseEntryHeader(second)
    if ((dateOnly.start || dateOnly.end) && !dateOnly.rest) {
      return { rest: first.rest, start: dateOnly.start, end: dateOnly.end, body: block.slice(2) }
    }
  }
  return { rest: first.rest, start: first.start, end: first.end, body: block.slice(1) }
}

function splitParts(rest: string): string[] {
  let parts = rest.split(/\s*[|｜]\s*/).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 1) {
    const spaced = rest.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
    if (spaced.length > 1) parts = spaced
  }
  if (parts.length === 1) {
    const tokens = rest.split(/\s+/).filter(Boolean)
    if (tokens.length > 1) parts = tokens
  }
  return parts.filter((part) => !/^[-–—·•|｜]+$/.test(part))
}

function stripBullet(line: string): string {
  const bullet = BULLET_RE.exec(line.trim())
  return bullet ? bullet[1]!.trim() : line.trim()
}

function parseEducation(lines: readonly string[]): Education[] {
  return splitBlocks(lines).map((block) => {
    const header = parseEntryBlock(block)
    const parts = splitParts(header.rest)
    let degree = ''
    const rest: string[] = []
    for (const part of parts) {
      if (!degree && DEGREE_RE.test(part)) degree = part
      else rest.push(part)
    }
    return {
      school: rest[0] ?? '',
      major: rest[1] ?? '',
      degree,
      start: header.start,
      end: header.end,
      notes: header.body.map(stripBullet).filter(Boolean).join('\n'),
    }
  })
}

function parseWork(lines: readonly string[]): Work[] {
  return splitBlocks(lines).map((block) => {
    const header = parseEntryBlock(block)
    const parts = splitParts(header.rest)
    const description: string[] = []
    const highlights: string[] = []
    for (const line of header.body) {
      const bullet = BULLET_RE.exec(line)
      if (bullet) highlights.push(bullet[1]!.trim())
      else description.push(line)
    }
    return {
      company: parts[0] ?? '',
      position: parts.slice(1).join(' · '),
      start: header.start,
      end: header.end,
      description: description.join('\n').trim(),
      highlights,
    }
  })
}

function parseProjects(lines: readonly string[]): Project[] {
  return splitBlocks(lines).map((block) => {
    const header = parseEntryBlock(block)
    const parts = splitParts(header.rest)
    const body = header.body.map((line) => {
      const bullet = BULLET_RE.exec(line)
      return bullet ? `- ${bullet[1]!.trim()}` : line
    })
    return {
      name: parts[0] ?? '',
      role: parts.slice(1).join(' · '),
      start: header.start,
      end: header.end,
      description: body.join('\n').trim(),
    }
  })
}

function splitSkillItems(text: string): string[] {
  return text.split(/[、,，;；|｜]+/).map((s) => s.trim()).filter(Boolean)
}

function parseSkills(lines: readonly string[]): SkillGroup[] {
  const groups: SkillGroup[] = []
  const plain: string[] = []
  for (const raw of lines) {
    const text = stripBullet(raw.trim())
    if (!text) continue
    const labeled = /^([^：:]{1,20})[：:]\s*(.+)$/.exec(text)
    if (labeled) groups.push({ category: labeled[1]!.trim(), items: splitSkillItems(labeled[2]!) })
    else plain.push(...splitSkillItems(text))
  }
  if (plain.length) groups.push({ category: '', items: plain })
  return groups
}

function parseCustomBody(lines: readonly string[]): string {
  return trimBlank(lines)
    .map((line) => {
      const bullet = BULLET_RE.exec(line.trim())
      return bullet ? `- ${bullet[1]!.trim()}` : line.trim()
    })
    .join('\n')
}

function hasBasics(basics: Basics): boolean {
  return Boolean(
    basics.name || basics.title || basics.phone || basics.email || basics.city || basics.summary
    || basics.extras.some((extra) => extra.value) || basics.photo,
  )
}

export function parseResumeText(text: string): ParsedResumeText {
  const resume = emptyResume()
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\u00a0/g, ' '))
  const sections: RawSection[] = [{ kind: 'preamble', title: '', lines: [] }]

  for (const line of lines) {
    const heading = detectHeading(line)
    if (heading) sections.push({ kind: heading.kind, title: heading.title, lines: [] })
    else sections[sections.length - 1]!.lines.push(line)
  }

  for (const section of sections) {
    switch (section.kind) {
      case 'preamble':
      case 'basics':
        applyBasics(section.lines, resume)
        break
      case 'education':
        resume.education.push(...parseEducation(section.lines))
        break
      case 'work':
        resume.work.push(...parseWork(section.lines))
        break
      case 'projects':
        resume.projects.push(...parseProjects(section.lines))
        break
      case 'skills':
        resume.skills.push(...parseSkills(section.lines))
        break
      case 'summary': {
        const body = trimBlank(section.lines).map((line) => line.trim()).join('\n')
        if (body) resume.basics.summary = resume.basics.summary ? `${resume.basics.summary}\n\n${body}` : body
        break
      }
      case 'custom': {
        const body = parseCustomBody(section.lines)
        if (body) resume.custom.push({ id: newSectionId(), title: section.title, body })
        break
      }
    }
  }

  resume.layout = defaultLayout(resume.custom.map((item) => item.id))

  return {
    resume,
    stats: {
      basics: hasBasics(resume.basics),
      education: resume.education.length,
      work: resume.work.length,
      projects: resume.projects.length,
      skills: resume.skills.length,
      custom: resume.custom.length,
    },
  }
}
