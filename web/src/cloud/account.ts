import { reactive } from 'vue'
import { parseAuthCallback, type AuthCallback } from './authCallback'
import { cloudConfigured, getClient, hasStoredSession } from './client'
import { defaultDisplayName, fetchProfile, saveAvatarPath, saveProfile } from './profile'

export interface AccountState {
  /** 是否配置了 Supabase（未配置时账号功能整体隐藏） */
  available: boolean
  /** 启动时正在恢复上次的登录会话 */
  restoring: boolean
  ready: boolean
  userId: string
  email: string
  /** 等待确认的新邮箱；空串表示没有待确认的换绑 */
  pendingEmail: string
  displayName: string
  /** 头像 Storage 对象路径；空串表示使用昵称首字 */
  avatarPath: string
  /** 账号创建时间（ISO），用于「加入于」展示 */
  createdAt: string | null
}

const callbackAtBoot: AuthCallback =
  typeof window === 'undefined' ? { kind: 'none' } : parseAuthCallback(location.search, location.hash)

export const account = reactive<AccountState>({
  available: cloudConfigured(),
  restoring: cloudConfigured() && (hasStoredSession() || callbackAtBoot.kind !== 'none'),
  ready: false,
  userId: '',
  email: '',
  pendingEmail: '',
  displayName: '',
  avatarPath: '',
  createdAt: null,
})

export interface SessionInfo {
  userId: string
  email: string
}

function resetAccount(): void {
  account.restoring = false
  account.ready = false
  account.userId = ''
  account.email = ''
  account.pendingEmail = ''
  account.displayName = ''
  account.avatarPath = ''
  account.createdAt = null
}

/**
 * 把 Supabase 用户与资料表合并进响应式账号状态。
 * 资料读取/创建失败不阻塞登录：昵称先回退为邮箱前缀。
 */
async function applyUser(user: {
  id: string
  email?: string | null
  new_email?: string | null
  created_at?: string
}): Promise<SessionInfo> {
  account.userId = user.id
  account.email = user.email ?? ''
  account.pendingEmail = user.new_email ?? ''
  account.displayName = defaultDisplayName(account.email)
  account.avatarPath = ''
  account.createdAt = user.created_at ?? null
  account.ready = true

  try {
    const client = await getClient()
    const profile = await fetchProfile(client, user.id)
    account.avatarPath = profile?.avatarPath ?? ''
    if (profile?.displayName) {
      account.displayName = profile.displayName
    } else {
      try {
        await saveProfile(client, user.id, account.displayName)
      } catch {
        // 资料表暂不可用时保留默认昵称，不影响简历功能
      }
    }
  } catch {
    // 资料读取失败同样保留默认昵称
  }

  return { userId: account.userId, email: account.email }
}

export interface BootstrapResult {
  session: SessionInfo | null
  callback: AuthCallback
}

let bootstrap: Promise<BootstrapResult> | null = null

/** 清掉地址里的认证参数：刷新不再重复触发，令牌也不留在浏览历史里 */
function clearAuthUrl(): void {
  try {
    const url = new URL(location.href)
    url.searchParams.delete('auth')
    url.hash = ''
    history.replaceState(history.state, '', url.pathname + url.search)
  } catch {
    // 地址异常时保留原样，不影响本次流程
  }
}

/**
 * 启动时恢复会话，并消费邮件链接（重置密码 / 更换邮箱）。
 * 没有会话也没有回调时不加载 Supabase SDK，保持匿名模式的首屏速度。
 */
export function initAccount(): Promise<BootstrapResult> {
  bootstrap ??= (async () => {
    const callback = callbackAtBoot
    try {
      if (!cloudConfigured()) return { session: null, callback: { kind: 'none' } }
      if (callback.kind === 'error') {
        clearAuthUrl()
        // 失效邮件链接不应影响本机已有的登录态
        if (!hasStoredSession()) return { session: null, callback }
      }
      if (callback.kind === 'none' && !hasStoredSession()) return { session: null, callback }

      const client = await getClient()
      // getSession 会等待 SDK 处理完 URL hash 里的邮件令牌
      const { data: { session } } = await client.auth.getSession()
      if (callback.kind !== 'none') clearAuthUrl()
      if (!session) return { session: null, callback }
      return { session: await applyUser(session.user), callback }
    } catch {
      return { session: null, callback }
    } finally {
      account.restoring = false
    }
  })()
  return bootstrap
}

function authRedirect(flow: 'recovery' | 'email-change'): string {
  const base = import.meta.env.BASE_URL || '/'
  const path = base.endsWith('/') ? base : `${base}/`
  return `${location.origin}${path}?auth=${flow}`
}

/** 发送密码重置邮件；无论邮箱是否存在都返回成功，避免泄露账号是否注册 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!cloudConfigured()) throw new Error('云服务未配置')
  const client = await getClient()
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirect('recovery'),
  })
  if (error) throw error
}

/** 在找回会话中设置新密码，并让其他设备上的会话失效 */
export async function completePasswordReset(password: string): Promise<void> {
  const client = await getClient()
  const { error } = await client.auth.updateUser({ password })
  if (error) throw error
  try {
    await client.auth.signOut({ scope: 'others' })
  } catch {
    // 其他设备清理失败不影响本机改密结果
  }
}

/** 发起换绑：Supabase 会向新旧邮箱发送确认邮件（开启 Secure Email Change 时） */
export async function changeEmail(nextEmail: string): Promise<void> {
  if (!account.ready) throw new Error('请先登录')
  const client = await getClient()
  const { data, error } = await client.auth.updateUser(
    { email: nextEmail },
    { emailRedirectTo: authRedirect('email-change') },
  )
  if (error) throw error
  account.pendingEmail = data.user?.new_email ?? nextEmail
}

/** 从服务端刷新用户信息（确认换绑后同步邮箱与待确认状态） */
export async function refreshAccount(): Promise<SessionInfo | null> {
  try {
    const client = await getClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return null
    return await applyUser(user)
  } catch {
    return null
  }
}

export async function signInAccount(email: string, password: string): Promise<SessionInfo> {
  if (!cloudConfigured()) throw new Error('云服务未配置')
  const client = await getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return applyUser(data.user)
}

export async function signUpAccount(email: string, password: string): Promise<SessionInfo> {
  if (!cloudConfigured()) throw new Error('云服务未配置')
  const client = await getClient()
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  if (!data.session || !data.user) {
    throw Object.assign(new Error('email_not_confirmed'), { code: 'email_not_confirmed' })
  }
  return applyUser(data.user)
}

export async function signOutAccount(): Promise<void> {
  try {
    const client = await getClient()
    await client.auth.signOut()
  } catch {
    // 本地登录态已在下面清空；网络失败不应阻止退出
  } finally {
    resetAccount()
  }
}

/** 保存昵称：空值拒绝，成功返回规范化后的资料 */
export async function updateDisplayName(rawName: string): Promise<string> {
  if (!account.ready) throw new Error('请先登录')
  const client = await getClient()
  const profile = await saveProfile(client, account.userId, rawName)
  account.displayName = profile.displayName
  return profile.displayName
}

/** 保存头像路径；null 表示移除头像、恢复首字 */
export async function updateAvatarPath(path: string | null): Promise<void> {
  if (!account.ready) throw new Error('请先登录')
  const client = await getClient()
  await saveAvatarPath(client, account.userId, path)
  account.avatarPath = path ?? ''
}
