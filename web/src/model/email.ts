/** 邮箱：注册、登录、找回密码、换绑共用同一套校验 */

const EMAIL_MAX_LENGTH = 254
const EMAIL_FORMAT = '邮箱格式不正确，例如 name@example.com'

/** 只去除首尾空白，保留大小写（邮箱本地部分可能区分大小写） */
export function normalizeEmail(value: string): string {
  return value.trim()
}

/** 返回第一条错误提示；合法时返回 null */
export function emailError(value: string): string | null {
  const email = normalizeEmail(value)
  if (!email) return '请输入邮箱'
  if (email.length > EMAIL_MAX_LENGTH) return '邮箱过长'
  if (/\s/.test(email)) return EMAIL_FORMAT

  const parts = email.split('@')
  if (parts.length !== 2) return EMAIL_FORMAT
  const [local, domain] = parts
  if (!local || !domain) return EMAIL_FORMAT
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return EMAIL_FORMAT
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return EMAIL_FORMAT
  if (!domain.includes('.')) return EMAIL_FORMAT
  return null
}
