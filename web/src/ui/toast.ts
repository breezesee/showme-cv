import { reactive } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  text: string
  kind: ToastKind
}

let seq = 0

/** 全局轻提示队列 */
export const toasts = reactive<Toast[]>([])

/** 显示一条提示，返回提前关闭它的函数 */
export function showToast(text: string, kind: ToastKind = 'info', duration = 2600): () => void {
  const id = ++seq
  toasts.push({ id, text, kind })
  if (toasts.length > 3) toasts.shift()
  const dismiss = () => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }
  window.setTimeout(dismiss, duration)
  return dismiss
}
