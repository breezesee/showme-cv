import type { Resume } from '../model/resume'

/** 导出文件名：姓名 + 简历 + 扩展名；无名时用「我的」（与打印页标题同一规则） */
export function exportFileName(resume: Resume, ext: 'pdf' | 'docx'): string {
  return `${resume.basics.name.trim() || '我的'}简历.${ext}`
}

/** 触发浏览器下载（一次性对象 URL，点击后延迟回收） */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
