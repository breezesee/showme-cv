import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { sampleResume } from '../model/resume'
import { buildWordBlob } from './word'

/** 解包 .docx（zip），取 word/document.xml 全文，断言排版内容 */
async function documentXml(resume: Parameters<typeof buildWordBlob>[0]): Promise<string> {
  const blob = await buildWordBlob(resume)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  expect(xml).toContain('w:body')
  return xml
}

describe('buildWordBlob', () => {
  it('生成真正的 .docx（zip 魔数 PK）', async () => {
    const blob = await buildWordBlob(sampleResume())
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect([head[0], head[1]]).toEqual([0x50, 0x4b])
  })

  it('含姓名大标题、职位、一行联系方式', async () => {
    const xml = await documentXml(sampleResume())
    expect(xml).toContain('李小明')
    expect(xml).toContain('产品经理')
    expect(xml).toContain('上海 · 138-0000-0000 · lixiaoming@example.com')
  })

  it('含全部四个分节标题与自我评价', async () => {
    const xml = await documentXml(sampleResume())
    for (const title of ['自我评价', '教育经历', '工作经历', '项目经历', '技能']) {
      expect(xml).toContain(title)
    }
    expect(xml).toContain('5 年互联网产品经验')
  })

  it('教育经历：学校 · 专业（学历）与起止期间（用 – 连接，与模板一致）', async () => {
    const xml = await documentXml(sampleResume())
    expect(xml).toContain('复旦大学 · 信息管理与信息系统（本科）')
    expect(xml).toContain('2015.09 – 2019.06')
  })

  it('工作经历：公司与职位、描述、亮点为项目符号列表', async () => {
    const xml = await documentXml(sampleResume())
    expect(xml).toContain('星海科技 · 高级产品经理')
    expect(xml).toContain('负责会员与增长业务线')
    expect(xml).toContain('主导会员业务改版')
    // docx 的项目符号通过 numbering reference 实现
    expect(xml).toMatch(/<w:numPr>[\s\S]*?<\/w:numPr>/)
  })

  it('项目描述多行文本：回车换行、- 行转为圆点', async () => {
    const xml = await documentXml(sampleResume())
    expect(xml).toContain('基于 LLM 的简历诊断与润色工具')
    expect(xml).toContain('上线 3 个月留存 45%')
    // 用户自己输入的 "- " 前缀被剥掉
    expect(xml).not.toContain('- 上线 3 个月留存 45%')
  })

  it('技能：分类与条目（、连接）在同一行', async () => {
    const xml = await documentXml(sampleResume())
    expect(xml).toContain('产品设计')
    expect(xml).toContain('需求分析、原型设计、用户研究、数据分析')
  })

  it('用户内容中的 XML 特殊字符被转义', async () => {
    const r = sampleResume()
    r.basics.name = '张三<甲>&乙'
    const xml = await documentXml(r)
    expect(xml).toContain('张三&lt;甲&gt;&amp;乙')
    expect(xml).not.toContain('张三<甲>')
  })

  it('空简历也能导出：无任何分节标题', async () => {
    const r = sampleResume()
    r.education = []
    r.work = []
    r.projects = []
    r.skills = []
    r.basics.summary = ''
    const xml = await documentXml(r)
    for (const title of ['自我评价', '教育经历', '工作经历', '项目经历', '技能']) {
      expect(xml).not.toContain(title)
    }
  })

  it('只有部分分节时只输出有内容的分节', async () => {
    const r = sampleResume()
    r.education = []
    r.projects = []
    r.skills = []
    r.basics.summary = ''
    const xml = await documentXml(r)
    expect(xml).not.toContain('自我评价')
    expect(xml).toContain('工作经历')
  })
})
