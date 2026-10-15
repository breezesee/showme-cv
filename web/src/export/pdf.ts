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

function waitLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    iframe.addEventListener('load', () => resolve(), { once: true })
    iframe.addEventListener('error', () => reject(new Error('渲染失败')), { once: true })
  })
}

/** 等字体就绪并让运行时完成重排（fonts.ready 之后再过两帧，分页结果才稳定） */
async function waitSettled(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) throw new Error('渲染失败')
  try {
    await doc.fonts?.ready
  } catch {
    /* 字体 API 不可用时直接继续 */
  }
  const nextFrame = () => new Promise<void>((r) => win.requestAnimationFrame(() => r()))
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
        const png = await domToPng(sheets[i]!, { scale: 2, backgroundColor: '#ffffff' })
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
