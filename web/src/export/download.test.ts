import { describe, expect, it } from 'vitest'
import { sampleResume } from '../model/resume'
import { exportFileName } from './download'

describe('exportFileName', () => {
  it('姓名 + 简历 + 扩展名', () => {
    expect(exportFileName(sampleResume(), 'docx')).toBe('李小明简历.docx')
    expect(exportFileName(sampleResume(), 'pdf')).toBe('李小明简历.pdf')
  })

  it('没有姓名时用「我的」兜底（与打印页同名规则）', () => {
    const r = sampleResume()
    r.basics.name = '  '
    expect(exportFileName(r, 'docx')).toBe('我的简历.docx')
  })
})
