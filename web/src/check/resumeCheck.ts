import { monthValue } from '../model/date'
import { visibleSectionIds } from '../model/layout'
import type { Resume } from '../model/resume'

/**
 * 投递前检查：纯本地规则，不上传简历内容。
 * target 是编辑器里的 DOM id（sec-* 或 entry-*），用于点击问题后跳转。
 */

export type CheckLevel = 'error' | 'warn' | 'tip'

export interface CheckIssue {
  id: string
  level: CheckLevel
  title: string
  detail: string
  target: string
}

export const CHECK_LEVEL_LABEL: Record<CheckLevel, string> = {
  error: '必须修改',
  warn: '建议检查',
  tip: '可以更好',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LONG_HIGHLIGHT = 80

function has(value: string): boolean {
  return value.trim() !== ''
}

function phoneDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length
}

function dateProblems(start: string, end: string): string[] {
  const problems: string[] = []
  if (has(start) && monthValue(start) === null) problems.push(`开始时间「${start.trim()}」无法识别`)
  if (has(end) && end.trim() !== '至今' && monthValue(end) === null) {
    problems.push(`结束时间「${end.trim()}」无法识别`)
  }
  const a = monthValue(start)
  const b = monthValue(end)
  if (a !== null && b !== null && b !== Number.POSITIVE_INFINITY && a > b) {
    problems.push('结束时间早于开始时间')
  }
  return problems
}

function push(
  issues: CheckIssue[],
  id: string,
  level: CheckLevel,
  title: string,
  detail: string,
  target: string,
): void {
  issues.push({ id, level, title, detail, target })
}

export function checkResume(resume: Resume): CheckIssue[] {
  const issues: CheckIssue[] = []
  const visible = new Set(visibleSectionIds(resume.layout, resume.custom.map((c) => c.id)))
  const { basics } = resume

  if (!has(basics.name)) {
    push(issues, 'name-missing', 'error', '缺少姓名', '姓名是简历最基本的身份信息，请先填写。', 'sec-basics')
  }
  if (!has(basics.phone)) {
    push(issues, 'phone-missing', 'warn', '缺少联系电话', '招聘方约面试时需要一个能联系到你的号码。', 'sec-basics')
  } else if (phoneDigits(basics.phone) < 7 || phoneDigits(basics.phone) > 15) {
    push(issues, 'phone-invalid', 'warn', '电话格式可能不正确', '请检查号码位数，建议写成 138-0000-0000。', 'sec-basics')
  }
  if (!has(basics.email)) {
    push(issues, 'email-missing', 'warn', '缺少邮箱', '不少公司会通过邮件发送面试与录用通知。', 'sec-basics')
  } else if (!EMAIL_RE.test(basics.email.trim())) {
    push(issues, 'email-invalid', 'warn', '邮箱格式可能不正确', '请检查是否缺少 @ 或域名后缀。', 'sec-basics')
  }

  if (resume.education.length === 0 && resume.work.length === 0 && resume.projects.length === 0) {
    push(
      issues,
      'experience-empty',
      'warn',
      '还没有任何经历',
      '至少补充一段教育、工作或项目经历，简历才有说服力。',
      'sec-education',
    )
  }

  if (visible.has('education')) {
    resume.education.forEach((edu, i) => {
      const target = `education-${i}`
      const missing: string[] = []
      if (!has(edu.school)) missing.push('学校')
      if (!has(edu.major)) missing.push('专业')
      if (!has(edu.start)) missing.push('开始时间')
      if (!has(edu.end)) missing.push('结束时间')
      if (missing.length) {
        push(issues, `education-fields-${i}`, 'warn', `教育经历 ${i + 1} 信息不完整`, `缺少：${missing.join('、')}。`, target)
      }
      const problems = dateProblems(edu.start, edu.end)
      if (problems.length) {
        push(issues, `education-date-${i}`, 'warn', `教育经历 ${i + 1} 日期需检查`, problems.join('；'), target)
      }
    })
  }

  if (visible.has('work')) {
    resume.work.forEach((work, i) => {
      const target = `work-${i}`
      const missing: string[] = []
      if (!has(work.company)) missing.push('公司')
      if (!has(work.position)) missing.push('职位')
      if (!has(work.start)) missing.push('开始时间')
      if (!has(work.end)) missing.push('结束时间')
      if (missing.length) {
        push(issues, `work-fields-${i}`, 'warn', `工作经历 ${i + 1} 信息不完整`, `缺少：${missing.join('、')}。`, target)
      }
      if (!has(work.description) && work.highlights.every((h) => !has(h))) {
        push(issues, `work-empty-${i}`, 'warn', `工作经历 ${i + 1} 没有内容`, '补充职责范围或 2-3 条有结果的亮点。', target)
      }
      const problems = dateProblems(work.start, work.end)
      if (problems.length) {
        push(issues, `work-date-${i}`, 'warn', `工作经历 ${i + 1} 日期需检查`, problems.join('；'), target)
      }
      const highlights = work.highlights.filter(has)
      const longCount = highlights.filter((h) => h.trim().length > LONG_HIGHLIGHT).length
      if (longCount) {
        push(
          issues,
          `work-long-highlight-${i}`,
          'tip',
          `工作经历 ${i + 1} 有 ${longCount} 条亮点过长`,
          `单条亮点建议控制在 ${LONG_HIGHLIGHT} 字内，先写结果再写做法。`,
          target,
        )
      }
      if (highlights.length && !highlights.some((h) => /\d/.test(h))) {
        push(
          issues,
          `work-unquantified-${i}`,
          'tip',
          `工作经历 ${i + 1} 的亮点没有量化结果`,
          '尝试补充百分比、金额、人数或时长，让成果更有说服力。',
          target,
        )
      }
    })
  }

  if (visible.has('projects')) {
    resume.projects.forEach((project, i) => {
      const target = `project-${i}`
      const missing: string[] = []
      if (!has(project.name)) missing.push('项目名称')
      if (!has(project.role)) missing.push('角色')
      if (!has(project.description)) missing.push('项目内容')
      if (missing.length) {
        push(issues, `project-fields-${i}`, 'warn', `项目经历 ${i + 1} 信息不完整`, `缺少：${missing.join('、')}。`, target)
      }
      const problems = dateProblems(project.start, project.end)
      if (problems.length) {
        push(issues, `project-date-${i}`, 'warn', `项目经历 ${i + 1} 日期需检查`, problems.join('；'), target)
      }
    })
  }

  if (visible.has('skills')) {
    resume.skills.forEach((skill, i) => {
      const missing: string[] = []
      if (!has(skill.category)) missing.push('分类')
      if (!skill.items.some(has)) missing.push('技能条目')
      if (missing.length) {
        push(issues, `skill-fields-${i}`, 'warn', `技能 ${i + 1} 信息不完整`, `缺少：${missing.join('、')}。`, `skill-${i}`)
      }
    })
  }

  if (visible.has('summary')) {
    const text = basics.summary.trim()
    if (!text) {
      push(issues, 'summary-empty', 'tip', '自我评价还是空的', '用 2-3 句话概括经验、优势与求职方向。', 'sec-summary')
    } else if (text.length < 30) {
      push(issues, 'summary-short', 'tip', '自我评价偏短', '补充你最擅长的领域和能带来的价值。', 'sec-summary')
    } else if (text.length > 600) {
      push(issues, 'summary-long', 'tip', '自我评价偏长', '招聘方通常只会快速浏览，建议压缩到 200 字以内。', 'sec-summary')
    }
  }

  return issues
}
