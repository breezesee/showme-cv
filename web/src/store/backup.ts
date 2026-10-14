import { parseResumeJson } from '../model/normalize'
import type { Resume } from '../model/resume'

/** 导出当前简历为 JSON 文件（格式与 Android 版 resume.json 一致） */
export function exportResumeFile(resume: Resume): void {
  const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ShowMe-${safeName(resume.basics.name) || '简历'}-${today()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 弹出文件选择框；用户取消时返回 null，格式非法时抛出 ResumeFormatError */
export function pickResumeFile(): Promise<Resume | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then((text) => {
        try {
          resolve(parseResumeJson(text))
        } catch (e) {
          reject(e)
        }
      }, reject)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

function safeName(s: string): string {
  return s.trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 20)
}

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}
