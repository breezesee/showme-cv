import { reactive } from 'vue'
import { cloudConfigured, getClient, hasStoredSession } from './client'
import { defaultDisplayName, fetchProfile, saveProfile } from './profile'

export interface AccountState {
  /** 是否配置了 Supabase（未配置时账号功能整体隐藏） */
  available: boolean
  /** 启动时正在恢复上次的登录会话 */
  restoring: boolean
  ready: boolean
  userId: string
  email: string
  displayName: string
  /** 账号创建时间（ISO），用于「加入于」展示 */
  createdAt: string | null
}

export const account = reactive<AccountState>({
  available: cloudConfigured(),
  restoring: cloudConfigured() && hasStoredSession(),
  ready: false,
  userId: '',
  email: '',
  displayName: '',
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
  account.displayName = ''
  account.createdAt = null
}

/**
 * 把 Supabase 用户与资料表合并进响应式账号状态。
 * 资料读取/创建失败不阻塞登录：昵称先回退为邮箱前缀。
 */
async function applyUser(user: {
  id: string
  email?: string | null
  created_at?: string
}): Promise<SessionInfo> {
  account.userId = user.id
  account.email = user.email ?? ''
  account.displayName = defaultDisplayName(account.email)
  account.createdAt = user.created_at ?? null
  account.ready = true

  try {
    const client = await getClient()
    const profile = await fetchProfile(client, user.id)
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

let bootstrap: Promise<SessionInfo | null> | null = null

/** 启动时恢复已保存的登录会话；没有会话时立即返回 null，不加载 Supabase SDK */
export function initAccount(): Promise<SessionInfo | null> {
  bootstrap ??= (async () => {
    try {
      if (!cloudConfigured() || !hasStoredSession()) return null
      const client = await getClient()
      const { data: { session } } = await client.auth.getSession()
      if (!session) return null
      return await applyUser(session.user)
    } catch {
      return null
    } finally {
      account.restoring = false
    }
  })()
  return bootstrap
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
