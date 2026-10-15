/** Supabase Auth 错误码 → 中文提示（按 code 匹配，message 随版本变化不可靠） */
const BY_CODE: Record<string, string> = {
  invalid_credentials: '邮箱或密码不正确',
  user_already_exists: '该邮箱已注册，请直接登录',
  email_exists: '该邮箱已注册，请直接登录',
  weak_password: '密码太简单，至少 6 位',
  email_address_invalid: '邮箱格式不正确',
  validation_failed: '邮箱格式不正确',
  over_request_rate_limit: '操作太频繁，请稍后再试',
  over_email_send_rate_limit: '操作太频繁，请稍后再试',
  email_not_confirmed: '该邮箱尚未验证',
}

export function authErrorMessage(e: unknown): string {
  if (typeof e !== 'object' || e === null) return '操作失败，请稍后重试'
  const { code, name, status } = e as { code?: unknown; name?: unknown; status?: unknown }
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code]
  if (name === 'AuthRetryableFetchError' || e instanceof TypeError || status === 0) return '网络异常，请稍后重试'
  return '操作失败，请稍后重试'
}
