import type { Resume } from '../model/resume'
import type { TemplateId } from './catalog'
import type { ThemeId } from './themes'

/** 模板渲染契约：模板脚本在 window 上暴露的渲染函数 */
export type ShowmeWindow = Window & { __showme_render?: (data: unknown) => void }

/** 渲染数据：简历内容 + 可选主题（运行时据此切换 html[data-theme]，见 templates/runtime.css） */
export interface RenderData extends Resume {
  showmeTheme?: string
}

const cache = new Map<TemplateId, Promise<string>>()

export function templateUrl(id: TemplateId): string {
  return `${import.meta.env.BASE_URL}templates/${id}.html`
}

/** 拉取模板 HTML（成功结果缓存；失败不缓存，下次可重试） */
export function fetchTemplate(id: TemplateId): Promise<string> {
  let p = cache.get(id)
  if (!p) {
    p = fetch(templateUrl(id)).then((res) => {
      if (!res.ok) throw new Error(`模板 ${id} 加载失败：HTTP ${res.status}`)
      return res.text()
    })
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}

/**
 * 在模板 </head> 前注入 window.__SHOWME_DATA__，模板脚本加载时自行渲染。
 * - 数据经两次 JSON.stringify 成为 JS 字符串字面量，'<' 转义为 \u003c，杜绝 </script> 截断；
 * - replace 使用函数形式，避免数据中的 $&、$' 等被当作替换模式。
 */
export function injectData(html: string, data: unknown, extraHead = ''): string {
  const literal = JSON.stringify(JSON.stringify(data)).replace(/</g, '\\u003c')
  const script = `<script>window.__SHOWME_DATA__ = JSON.parse(${literal});</script>`
  return html.replace('</head>', () => script + extraHead + '</head>')
}

/** 去除响应式代理，得到可跨文档传递的纯数据 */
export function plainResume(resume: Resume): Resume {
  return JSON.parse(JSON.stringify(resume)) as Resume
}

/** 去响应式并附加主题，得到可跨文档传递的渲染数据 */
export function renderPayload(resume: Resume, themeId?: ThemeId): RenderData {
  const data = plainResume(resume) as RenderData
  if (themeId) data.showmeTheme = themeId
  return data
}
