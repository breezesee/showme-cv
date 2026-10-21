/**
 * 浏览器本地存储的安全读写：隐私模式、配额已满、存储被禁用时不抛异常。
 * 仅供 store/、relay/ 与 print/ 内部使用，界面组件不直接访问。
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // 存储不可用时无需处理
    }
  },
}

/** 标签页级存储：刷新后仍在、关闭标签页即清空；用于跨整页刷新的短时交接 */
export const session = {
  get(key: string): string | null {
    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): boolean {
    try {
      window.sessionStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
  remove(key: string): void {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      // 存储不可用时无需处理
    }
  },
}
