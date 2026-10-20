import { loadPrintPayload } from './print/payload'
import { fetchTemplate, injectData, renderPayload, type ShowmeWindow } from './templates/loader'
import { assertUpToDate } from './version'

/**
 * 打印页：把模板渲染为顶层文档后唤起浏览器打印。
 * 顶层文档打印在手机浏览器上比 iframe 内打印可靠；分页由模板运行时完成（一张 .sheet 对应一页 A4），
 * @page / @media print 只负责纸张尺寸与隐藏顶栏。
 */

/** A4 纸宽（CSS px）。窄屏上屏幕显示时把纸张整体缩小（不影响打印），顶栏保持正常大小 */
const PAPER_W = 794

function fitPaper(): void {
  const zoom = Math.min(1, (window.innerWidth - 16) / PAPER_W)
  document.documentElement.style.setProperty('--sm-zoom', String(Math.max(zoom, 0.2)))
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function platformHint(): string {
  const ua = navigator.userAgent
  const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (iOS) return '点「打印 / 存为 PDF」→ 在打印预览中点右上角分享按钮 →「存储到"文件"」即可得到 PDF。'
  if (/Android/.test(ua)) return '点「打印 / 存为 PDF」→ 在页面顶部选择「另存为 PDF」→ 点下载图标。'
  return '在打印对话框中将「目标打印机」选为「另存为 PDF」；建议在「更多设置」中取消勾选「页眉和页脚」。'
}

const BAR_STYLE = `<style>
.sm-bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;
background:rgba(242,242,247,.92);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);
border-bottom:1px solid rgba(60,60,67,.12);font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.sm-bar p{flex:1 1 260px;margin:0;font-size:13px;color:#6e6e73;line-height:1.5}
.sm-bar button{min-height:44px;padding:0 18px;border:none;border-radius:999px;font-size:15px;font-weight:500;cursor:pointer}
.sm-back{background:rgba(118,118,128,.12);color:#0a84ff}.sm-print{background:#0a84ff;color:#fff}
@media print{.sm-bar{display:none!important}}
@media screen{#app{zoom:var(--sm-zoom,1)}}
</style>`

function barHtml(): string {
  return `<div class="sm-bar">
<button class="sm-back" type="button" onclick="if(window.opener){window.close()}else{location.href='./'}">‹ 返回</button>
<p>${escapeHtml(platformHint())}</p>
<button class="sm-print" type="button" onclick="window.print()">打印 / 存为 PDF</button>
</div>`
}

function showMessage(text: string): void {
  document.body.replaceChildren()
  const p = document.createElement('p')
  p.style.cssText = 'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#77777d;text-align:center;margin:40vh 24px 0;line-height:1.7'
  p.textContent = text
  const a = document.createElement('a')
  a.href = './'
  a.textContent = '返回 ShowMe'
  a.style.cssText = 'display:block;margin-top:12px;color:#0a84ff'
  p.appendChild(a)
  document.body.appendChild(p)
}

/** 字体与照片就绪后再唤起打印；最多等 3 秒，慢网也不阻塞 */
async function waitReadyForPrint(): Promise<void> {
  const fonts = document.fonts?.ready ?? Promise.resolve()
  const images = [...document.querySelectorAll<HTMLImageElement>('img.r-photo')]
  const decoded = images.map((img) => {
    if (typeof img.decode === 'function') return img.decode().catch(() => undefined)
    if (img.complete) return Promise.resolve()
    return new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true })
      img.addEventListener('error', () => resolve(), { once: true })
    })
  })
  await Promise.race([
    Promise.all([fonts.catch(() => undefined), ...decoded])
      .then(() => new Promise<void>((resolve) => setTimeout(resolve, 150))),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ])
}

async function main(): Promise<void> {
  const payload = loadPrintPayload()
  if (!payload) {
    showMessage('没有找到要打印的简历，请回到 ShowMe 重新点击「打印 / 导出 PDF」。')
    return
  }
  let template: string
  try {
    await assertUpToDate() // 过期页面禁止打印（与导出同一混合版本防护）
  } catch {
    showMessage('检测到新版本，请回到 ShowMe 点页脚「清除缓存并刷新」后重新打印。')
    return
  }
  try {
    template = await fetchTemplate(payload.templateId)
  } catch {
    showMessage('模板加载失败，请刷新页面后重试。')
    return
  }
  // 文档标题即浏览器"另存为 PDF"时的默认文件名
  const title = `${payload.resume.basics.name.trim() || '我的'}简历`
  const html = injectData(template, renderPayload(payload.resume, payload.themeId), BAR_STYLE)
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`)
    .replace(/<body([^>]*)>/i, (m) => m + barHtml())

  // 写入内容均受控：本站静态模板 + 已转义的数据字面量 / 标题 / 提示；用户内容由运行时 SM.esc 转义后渲染
  document.open()
  document.write(html)
  document.close()

  // document.open() 会清掉窗口上的监听，必须在写入之后再挂
  fitPaper()
  window.addEventListener('resize', fitPaper)
  // 缩放下的文字换行可能与原大小略有不同：打印前恢复原大小并重新分页，保证与纸张一致
  window.addEventListener('beforeprint', () => {
    document.documentElement.style.setProperty('--sm-zoom', '1')
    ;(window as ShowmeWindow).__showme_render?.(renderPayload(payload.resume, payload.themeId))
  })
  window.addEventListener('afterprint', fitPaper)

  // 等照片与字体稳定后自动唤起打印；部分移动浏览器会忽略非点击触发的打印，此时用顶栏按钮
  void waitReadyForPrint().then(() => window.print())
}

void main()
