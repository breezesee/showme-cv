import { ResumeFormatError, sameResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { savePrintPayload } from '../print/payload'
import { exportResumeFile, pickResumeFile } from '../store/backup'
import { useResume } from '../store/useResume'
import type { TemplateId } from '../templates/catalog'
import { plainResume } from '../templates/loader'
import { DEFAULT_THEME, type ThemeId } from '../templates/themes'
import { confirmDialog } from './confirm'
import { showToast } from './toast'

/** 界面层共用操作：工具栏、分享页、"收到的简历"视图都调用这里 */

/** 打开独立打印页。必须在点击事件中同步调用，否则新窗口会被拦截 */
export function printResume(resume: Resume, templateId: TemplateId, themeId?: ThemeId): void {
  if (!savePrintPayload({ resume: plainResume(resume), templateId, themeId: themeId ?? DEFAULT_THEME })) {
    showToast('浏览器禁止了本地存储，无法打开打印页', 'error')
    return
  }
  const win = window.open('print.html', '_blank')
  if (win) return
  void confirmDialog({
    title: '无法打开新窗口',
    message: '浏览器拦截了打印页的新窗口。是否在当前页面打开打印页？（打印完可点「返回」回来）',
    confirmText: '在当前页面打开',
  }).then((ok) => {
    if (ok) window.location.assign('print.html')
  })
}

/** 直出 PDF：离屏渲染真实模板逐页截图打包（与预览一致，无需打印对话框）。重依赖按需加载 */
export async function exportPdf(resume: Resume, templateId: TemplateId, themeId: ThemeId): Promise<void> {
  const { exportResumePdf } = await import('../export/pdf')
  await exportResumePdf(resume, templateId, themeId)
  showToast('已导出 PDF', 'success')
}

/** 直出 Word（.docx）：统一简洁排版，可继续编辑 */
export async function exportWord(resume: Resume): Promise<void> {
  const { exportResumeWord } = await import('../export/word')
  await exportResumeWord(plainResume(resume))
  showToast('已导出 Word 文档', 'success')
}

export function exportCurrent(): void {
  const { resume } = useResume()
  exportResumeFile(plainResume(resume.value))
  showToast('已导出备份文件', 'success')
}

export async function importFromFile(): Promise<void> {
  const { resume, replaceResume } = useResume()
  let picked: Resume | null
  try {
    picked = await pickResumeFile()
  } catch (e) {
    showToast(e instanceof ResumeFormatError ? '文件格式不正确，未导入' : '读取文件失败', 'error')
    return
  }
  if (!picked) return
  if (sameResume(picked, resume.value)) {
    showToast('文件内容与当前简历相同')
    return
  }
  if (!(await confirmOverwrite(picked))) return
  replaceResume(picked)
  showToast('已导入备份文件', 'success')
}

/** 覆盖本机简历前的二次确认（展示对方姓名，降低误覆盖） */
export function confirmOverwrite(incoming: Resume): Promise<boolean> {
  const name = incoming.basics.name.trim() || '未命名'
  return confirmDialog({
    title: '覆盖本机简历？',
    message: `将用「${name}」的简历覆盖本机当前简历，覆盖后无法恢复。可先「导出备份」再导入。`,
    confirmText: '覆盖',
    danger: true,
  })
}
