import { reactive } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

/** 提示里的可选操作（如「撤销」） */
export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  text: string
  kind: ToastKind
  action?: ToastAction
}

let seq = 0

/** 全局轻提示队列 */
export const toasts = reactive<Toast[]>([])

/** 显示一条提示，返回提前关闭它的函数 */
export function showToast(text: string, kind: ToastKind = 'info', duration = 2600, action?: ToastAction): () => void {
  const id = ++seq
  toasts.push({ id, text, kind, action })
  if (toasts.length > 3) toasts.shift()
  const dismiss = removeToast.bind(null, id)
  window.setTimeout(dismiss, duration)
  return dismiss
}

export function removeToast(id: number): void {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}
