import { describe, expect, it } from 'vitest'
import { monthValue } from '../model/date'
import { emptyResume, sampleResume } from '../model/resume'
import { checkResume } from './resumeCheck'

const ids = (issues: ReturnType<typeof checkResume>) => issues.map((i) => i.id)

describe('checkResume', () => {
  it('完整示例简历没有需要处理的问题', () => {
    expect(checkResume(sampleResume())).toEqual([])
  })

  it('空简历：姓名是错误，联系方式与经历是提醒', () => {
    const issues = checkResume(emptyResume())
    expect(issues.find((i) => i.id === 'name-missing')?.level).toBe('error')
    expect(issues.find((i) => i.id === 'phone-missing')?.level).toBe('warn')
    expect(issues.find((i) => i.id === 'email-missing')?.level).toBe('warn')
    expect(issues.find((i) => i.id === 'experience-empty')?.level).toBe('warn')
    expect(issues.find((i) => i.id === 'summary-empty')?.level).toBe('tip')
  })

  it('邮箱与电话格式错误给出提醒', () => {
    const r = sampleResume()
    r.basics.email = 'not-an-email'
    r.basics.phone = '123'
    const got = ids(checkResume(r))
    expect(got).toContain('email-invalid')
    expect(got).toContain('phone-invalid')
  })

  it('工作经历缺字段、日期倒置与空描述', () => {
    const r = sampleResume()
    r.work[0] = {
      company: '',
      position: '',
      start: '2024.06',
      end: '2023.01',
      description: '',
      highlights: [],
    }
    const issues = checkResume(r)
    expect(issues.find((i) => i.id === 'work-fields-0')?.detail).toContain('公司')
    expect(issues.find((i) => i.id === 'work-fields-0')?.target).toBe('work-0')
    expect(issues.find((i) => i.id === 'work-empty-0')?.level).toBe('warn')
    expect(issues.find((i) => i.id === 'work-date-0')?.detail).toContain('早于')
  })

  it('教育、项目与技能缺项', () => {
    const r = sampleResume()
    r.education[0] = { school: '', major: '', degree: '', start: '', end: '', notes: '' }
    r.projects[0] = { name: '', role: '', start: '', end: '', description: '' }
    r.skills[0] = { category: '', items: [] }
    const got = ids(checkResume(r))
    expect(got).toContain('education-fields-0')
    expect(got).toContain('project-fields-0')
    expect(got).toContain('skill-fields-0')
  })

  it('亮点过长或全部没有数字给出提示', () => {
    const r = sampleResume()
    r.work[0]!.highlights = ['负责产品规划与跨团队协作，推动业务持续增长并优化用户体验'.repeat(3)]
    r.work[1]!.highlights = ['负责协同办公工具的产品设计']
    const got = ids(checkResume(r))
    expect(got).toContain('work-long-highlight-0')
    expect(got).toContain('work-unquantified-1')
  })

  it('隐藏板块不参与检查', () => {
    const r = sampleResume()
    r.work = [{ company: '', position: '', start: '', end: '', description: '', highlights: [] }]
    r.layout.hidden = ['work']
    expect(ids(checkResume(r))).not.toContain('work-fields-0')
  })

  it('日期识别使用统一的月份归一化', () => {
    expect(monthValue('2022年7月')).toBe(2022 * 12 + 6)
  })
})
