/** 识别 Supabase 邮件链接回到站点后的 URL 状态（隐式流程把结果放在 hash 里） */

export type AuthFlow = 'recovery' | 'email-change'

export type AuthCallback =
  | { kind: 'none' }
  | { kind: 'recovery' }
  | { kind: 'email_change' }
  | { kind: 'error'; flow: AuthFlow | null; description: string }

function readParams(raw: string): URLSearchParams {
  return new URLSearchParams(raw.replace(/^[?#]/, ''))
}

function asFlow(value: string | null): AuthFlow | null {
  if (value === 'recovery') return 'recovery'
  if (value === 'email-change' || value === 'email_change') return 'email-change'
  return null
}

/**
 * 成功回调带 access_token + type；失败回调只有 error/error_code。
 * redirectTo 上的 ?auth= 用于失败时仍能判断属于哪个流程。
 */
export function parseAuthCallback(search: string, hash: string): AuthCallback {
  const query = readParams(search)
  const h = readParams(hash)
  const flow = asFlow(h.get('type')) ?? asFlow(query.get('auth'))

  if (h.has('error') || h.has('error_code')) {
    return {
      kind: 'error',
      flow,
      // Supabase 的 error_description 是英文，面向用户统一用中文兜底文案
      description: '链接已失效',
    }
  }

  if (!h.get('access_token')) {
    // 带流程标记却没有令牌：令牌已被邮件客户端预取或 hash 被丢弃，
    // 仍按该流程的失效态处理，避免无声落回编辑页
    if (flow) return { kind: 'error', flow, description: '链接已失效' }
    return { kind: 'none' }
  }
  if (flow === 'recovery') return { kind: 'recovery' }
  if (flow === 'email-change') return { kind: 'email_change' }
  return { kind: 'none' }
}

/**
 * 邮件链接的落地地址。base 可能是相对的 './'（产物可部署在子路径），
 * 必须基于当前地址解析成绝对 URL，否则会拼出带尾点的错误主机名，
 * 被 Supabase 判定为未授权后回退到不带 ?auth= 的 Site URL。
 */
export function buildAuthRedirect(flow: AuthFlow, base: string, href: string): string {
  const url = new URL(base || '/', href)
  url.searchParams.set('auth', flow)
  return url.href
}
