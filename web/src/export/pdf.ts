/**
 * PDF 导出：图片式直出——离屏 iframe 用真实模板渲染整份简历，逐页（.sheet）截图后打包进 PDF。
 * 与预览完全一致（模板、主题、分页都由模板运行时完成），无需用户操作打印对话框。
 * 三个重依赖（jspdf / modern-screenshot / 模板）全部动态加载，不进主包。
 */
import type { Resume } from '../model/resume'
import { downloadBlob, exportFileName } from './download'
import { fetchTemplate, injectData, renderPayload } from '../templates/loader'
import type { TemplateId } from '../templates/catalog'
import type { ThemeId } from '../templates/themes'

/** A4 纸宽（CSS px），与打印页一致的测量宽度 */
const PAPER_W = 794

/** 截图克隆用的最小结构：真实 DOM 节点与测试桩都满足 */
export interface StyleNode {
  readonly namespaceURI?: string | null
  readonly children: readonly StyleNode[]
  readonly style: CSSStyleDeclaration
}

const XHTML_NS = 'http://www.w3.org/1999/xhtml'
/** 会把文字冻进固定盒子的属性：剥掉后克隆按内嵌样式表自然排版，重排差异最多引起正常折行，不再叠印 */
const FROZEN_PROPS = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'] as const

/**
 * 剥掉克隆后代内联的宽高约束（modern-screenshot 会把每个元素的计算样式 width/height 内联进克隆）。
 * 收缩适配元素（如条目标题）的冻结宽度恰等于文字宽度，栅格化时零点几像素的取整差异
 * 就会让末字折行；高度同被冻结，折行第二行会叠印到下一行——即导出 PDF 的「乱符号」。
 * 根节点（纸张）的尺寸由调用方显式传入，不受影响。
 * @returns 剥掉的属性个数
 */
export function stripFrozenDimensions(root: StyleNode): number {
  let stripped = 0
  const walk = (el: StyleNode) => {
    for (const child of el.children) {
      if ((child.namespaceURI ?? XHTML_NS) === XHTML_NS) {
        for (const prop of FROZEN_PROPS) {
          if (child.style.getPropertyValue(prop) !== '') {
            child.style.removeProperty(prop)
            stripped++
          }
        }
        walk(child)
      }
    }
  }
  walk(root)
  return stripped
}

function waitLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    iframe.addEventListener('load', () => resolve(), { once: true })
    iframe.addEventListener('error', () => reject(new Error('渲染失败')), { once: true })
  })
}

/** 等字体就绪并让运行时完成重排（fonts.ready 之后再过两帧，分页结果才稳定；rAF 在遮挡窗口会停摆，加超时兜底） */
async function waitSettled(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) throw new Error('渲染失败')
  try {
    await doc.fonts?.ready
  } catch {
    /* 字体 API 不可用时直接继续 */
  }
  const nextFrame = () =>
    Promise.race([
      new Promise<void>((r) => win.requestAnimationFrame(() => r())),
      new Promise<void>((r) => setTimeout(r, 400)),
    ])
  await nextFrame()
  await nextFrame()
}

export async function renderResumePdf(resume: Resume, templateId: TemplateId, themeId: ThemeId): Promise<Blob> {
  const [{ jsPDF }, { domToPng }, template] = await Promise.all([
    import('jspdf'),
    import('modern-screenshot'),
    fetchTemplate(templateId),
  ])

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.title = ''
  // 不用 display:none：隐藏文档无法排版分页
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAPER_W}px;height:1123px;border:0;visibility:hidden`
  iframe.srcdoc = injectData(template, renderPayload(resume, themeId))
  document.body.appendChild(iframe)

  try {
    await waitLoad(iframe)
    await waitSettled(iframe)
    const doc = iframe.contentDocument
    if (!doc) throw new Error('渲染失败')
    const sheets = [...doc.querySelectorAll('#app .sheet')]
    if (sheets.length === 0) throw new Error('渲染失败')

    const pdf = await (async () => {
      const first = sheets[0]!.getBoundingClientRect()
      const instance = new jsPDF({
        unit: 'px',
        format: [first.width, first.height],
        orientation: 'portrait',
        compress: true,
      })
      for (let i = 0; i < sheets.length; i++) {
        const rect = sheets[i]!.getBoundingClientRect()
        if (i > 0) instance.addPage([rect.width, rect.height], 'portrait')
        const png = await domToPng(sheets[i]!, {
          scale: 2,
          backgroundColor: '#ffffff',
          // 剥掉克隆后代的冻结宽高：栅格化时按样式表自然排版，杜绝末字折行叠印（详见 stripFrozenDimensions）
          onCloneNode: (cloned) => {
            stripFrozenDimensions(cloned as unknown as StyleNode)
          },
        })
        instance.addImage(png, 'PNG', 0, 0, rect.width, rect.height)
      }
      return instance
    })()
    return pdf.output('blob')
  } finally {
    iframe.remove()
  }
}

export async function exportResumePdf(resume: Resume, templateId: TemplateId, themeId: ThemeId): Promise<void> {
  const blob = await renderResumePdf(resume, templateId, themeId)
  downloadBlob(blob, exportFileName(resume, 'pdf'))
}
