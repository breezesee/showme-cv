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

/** document.xml 中的段落（<w:p>，不含 <w:pPr>） */
function paragraphs(xml: string): string[] {
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0])
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

  it('工作亮点每条独立成段，各自带项目符号', async () => {
    const bullets = paragraphs(await documentXml(sampleResume())).filter(
      (p) => p.includes('主导会员业务改版') || p.includes('搭建数据看板体系'),
    )
    expect(bullets).toHaveLength(2)
    for (const p of bullets) expect(p).toContain('<w:numPr>')
  })

  it('项目内容的每条要点独立成段，不与段落文字挤在一起', async () => {
    const bullets = paragraphs(await documentXml(sampleResume())).filter(
      (p) => p.includes('上线 3 个月留存 45%') || p.includes('获公司年度创新奖'),
    )
    expect(bullets).toHaveLength(2)
    for (const p of bullets) expect(p).toContain('<w:numPr>')
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

  it('默认顺序把自我评价放在最后', async () => {
    const xml = await documentXml(sampleResume())
    expect(xml.indexOf('教育经历')).toBeLessThan(xml.indexOf('工作经历'))
    expect(xml.indexOf('技能')).toBeLessThan(xml.indexOf('自我评价'))
  })

  it('遵守 layout 顺序与隐藏，自我评价可移到最前', async () => {
    const r = sampleResume()
    r.layout = { order: ['summary', 'work', 'education', 'projects', 'skills'], hidden: ['projects'] }
    const xml = await documentXml(r)
    expect(xml.indexOf('自我评价')).toBeLessThan(xml.indexOf('工作经历'))
    expect(xml.indexOf('工作经历')).toBeLessThan(xml.indexOf('教育经历'))
    expect(xml).not.toContain('项目经历')
    expect(xml).not.toContain('智能简历助手')
  })

  it('附加信息追加到联系方式行，空值不导出', async () => {
    const r = sampleResume()
    r.basics.extras = [
      { label: '微信', value: 'showme' },
      { label: '', value: 'https://example.com' },
      { label: '空', value: '  ' },
    ]
    const xml = await documentXml(r)
    expect(xml).toContain('上海 · 138-0000-0000 · lixiaoming@example.com · 微信：showme · https://example.com')
    expect(xml).not.toContain('空：')
  })

  it('自定义模块：标题与正文按顺序导出，空正文与空标题正确处理', async () => {
    const r = sampleResume()
    r.custom = [
      { id: 'awards', title: '荣誉奖项', body: '- 全球设计金奖\n\n补充说明' },
      { id: 'blank', title: '空模块', body: '' },
      { id: 'notitle', title: '', body: '无标题正文' },
    ]
    r.layout = {
      order: ['education', 'work', 'projects', 'skills', 'summary', 'custom:awards', 'custom:blank', 'custom:notitle'],
      hidden: [],
    }
    const xml = await documentXml(r)
    expect(xml.indexOf('荣誉奖项')).toBeLessThan(xml.indexOf('全球设计金奖'))
    expect(xml).toContain('补充说明')
    expect(xml).not.toContain('空模块')
    expect(xml).toContain('无标题正文')
  })

  it('有照片时页头为无边框两列表格并嵌入图片', async () => {
    const blob = await buildWordBlob(sampleResume(), {
      data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      type: 'jpg',
    })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('<w:drawing>')
    expect(xml).toContain('李小明')
    expect(xml).toContain('上海 · 138-0000-0000 · lixiaoming@example.com')
  })

  it('无照片时页头不用表格，保持居中文案', async () => {
    const xml = await documentXml(sampleResume())
    expect(xml).not.toContain('<w:tbl>')
    expect(xml).toContain('<w:jc w:val="center"/>')
  })
})
