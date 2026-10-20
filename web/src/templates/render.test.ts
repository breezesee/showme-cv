import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { beforeAll, describe, expect, it } from 'vitest'
import { normalizeResume } from '../model/normalize'
import type { Resume } from '../model/resume'

/** 三套模板的真实渲染函数：在独立上下文里执行模板脚本，捕获 SM.mount 注册的 build */
type TemplateId = 'classic' | 'air' | 'duo'

interface Built {
  sheet(): string
  flows: Record<string, string>
}

const runtimeSource = readFileSync(new URL('../../templates/runtime.js', import.meta.url), 'utf8')
let runtime: Record<string, unknown>

beforeAll(() => {
  const win: { SM?: Record<string, unknown> } = {}
  runInNewContext(runtimeSource, { window: win })
  runtime = win.SM!
})

function buildTemplate(id: TemplateId, data: Resume & { photoURL?: string }): Built {
  const html = readFileSync(new URL(`../../templates/${id}.html`, import.meta.url), 'utf8')
  const code = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (!code) throw new Error(`${id}.html 缺少渲染脚本`)

  let build: ((d: Resume) => Built) | undefined
  const SM = {
    ...runtime,
    mount(fn: (d: Resume) => Built) {
      build = fn
    },
  }
  runInNewContext(code, { SM, window: {} })
  if (!build) throw new Error(`${id}.html 未调用 SM.mount`)
  return build(data)
}

const resume = normalizeResume({
  basics: {
    name: '李小明',
    title: '产品经理',
    phone: '138-0000-0000',
    email: 'lixiaoming@example.com',
    city: '上海',
    summary: '擅长数据驱动的产品设计。',
    extras: [
      { label: '微信', value: 'showme' },
      { label: '主页', value: 'https://example.com/me?a=1&b=2' },
    ],
  },
  education: [{ school: '复旦大学', major: '信息管理', degree: '本科', start: '2015.09', end: '2019.06' }],
  work: [{ company: '星海科技', position: '产品经理', start: '2022.07', end: '至今', description: '负责增长业务。' }],
  projects: [{ name: '智能简历助手', role: '产品负责人', description: '简历诊断工具。' }],
  skills: [{ category: '工具', items: ['Figma', 'SQL'] }],
  custom: [
    { id: 'awards', title: '荣誉奖项', body: '- 年度创新奖' },
    { id: 'empty', title: '空模块', body: '' },
  ],
  layout: {
    order: ['work', 'education', 'custom:awards', 'projects', 'skills', 'summary'],
    hidden: ['projects'],
  },
})

describe('模板渲染：附加信息', () => {
  it('单栏模板把附加项追加到联系方式，值中的 URL 显示为链接并转义', () => {
    const html = buildTemplate('classic', resume).flows.main
    expect(html).toContain('微信：showme')
    expect(html).toContain('href="https://example.com/me?a=1&amp;b=2"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('双栏模板把附加项逐行放进联系方式区', () => {
    const side = buildTemplate('duo', resume).flows.side
    expect(side).toContain('微信：showme')
    expect(side).toContain('https://example.com/me?a=1&amp;b=2')
  })
})

describe('模板渲染：自定义模块与板块布局', () => {
  it.each<TemplateId>(['classic', 'air'])('%s 按 order 渲染、跳过隐藏项与空模块', (id) => {
    const html = buildTemplate(id, resume).flows.main
    expect(html.indexOf('工作经历')).toBeLessThan(html.indexOf('教育经历'))
    expect(html).not.toContain('项目经历')
    expect(html).toContain('荣誉奖项')
    expect(html).toContain('年度创新奖')
    expect(html).not.toContain('空模块')
    expect(html.indexOf('荣誉奖项')).toBeLessThan(html.indexOf('技能'))
  })

  it('双栏模板保持左栏教育/技能、右栏其余，顺序在栏内生效', () => {
    const { flows } = buildTemplate('duo', resume)
    expect(flows.side).toContain('教育经历')
    expect(flows.side).toContain('技能')
    expect(flows.side).not.toContain('工作经历')
    expect(flows.main).toContain('工作经历')
    expect(flows.main).toContain('荣誉奖项')
    expect(flows.main).not.toContain('项目经历')
    expect(flows.main.indexOf('工作经历')).toBeLessThan(flows.main.indexOf('荣誉奖项'))
  })

  it('自定义模块标题被转义，空标题只渲染正文', () => {
    const data = normalizeResume({
      custom: [{ id: 'x', title: '<b>标题</b>', body: '正文' }, { id: 'y', title: '', body: '无标题正文' }],
      layout: { order: ['custom:x', 'custom:y'], hidden: [] },
    })
    const html = buildTemplate('classic', data).flows.main
    expect(html).toContain('&lt;b&gt;标题&lt;/b&gt;')
    expect(html).not.toContain('<b>标题</b>')
    expect(html).toContain('无标题正文')
    expect(html).not.toContain('<h2 data-u data-keep></h2>')
  })
})

describe('模板渲染：照片', () => {
  const photoURL = 'https://demo.supabase.co/storage/v1/object/public/resume-photos/u1/p1.jpg'
  const withPhoto = { ...resume, photoURL }

  it.each<TemplateId>(['classic', 'air'])('%s 在页头渲染照片，无照片时不出现图片', (id) => {
    expect(buildTemplate(id, withPhoto).flows.main).toContain(
      `<img class="r-photo" src="${photoURL}" alt="" onerror="this.remove()">`,
    )
    expect(buildTemplate(id, resume).flows.main).not.toContain('r-photo')
  })

  it('双栏模板把照片放在侧栏顶部，无照片时不占位', () => {
    const side = buildTemplate('duo', withPhoto).flows.side
    expect(side).toContain(`<img class="r-photo side-photo" src="${photoURL}" alt="" onerror="this.remove()">`)
    expect(side.indexOf('side-photo')).toBeLessThan(side.indexOf('李小明'))
    expect(buildTemplate('duo', resume).flows.side).not.toContain('r-photo')
  })
})
