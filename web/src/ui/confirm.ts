import { reactive } from 'vue'

/** 应用内确认弹窗：替代 window.confirm，样式与设计系统一致 */

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  /** 危险操作：确认按钮用红色，且默认聚焦「取消」 */
  danger?: boolean
}

interface ConfirmRequest extends Required<ConfirmOptions> {
  resolve: (ok: boolean) => void
}

export const confirmState = reactive<{ current: ConfirmRequest | null }>({ current: null })

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // 同一时间只有一个确认弹窗：上一个按「取消」处理
  confirmState.current?.resolve(false)
  return new Promise((resolve) => {
    confirmState.current = {
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? '确定',
      cancelText: options.cancelText ?? '取消',
      danger: options.danger ?? false,
      resolve,
    }
  })
}

export function settleConfirm(ok: boolean): void {
  const current = confirmState.current
  if (!current) return
  confirmState.current = null
  current.resolve(ok)
}
