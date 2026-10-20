import { AVATAR_BUCKET } from '../model/avatar'
import { cloudConfigured, getClient } from './client'

/** Storage 对象路径：用户目录 + 随机文件名，扩展名固定 jpg */
export function avatarStoragePath(uid: string, id: string): string {
  return `${uid}/${id}.jpg`
}

/** 把 Storage / 网络错误翻译为可操作的中文提示 */
export function avatarUploadError(message: string): string {
  const text = message.toLowerCase()
  if (/bucket.*not found|not found/.test(text)) return '头像存储尚未配置，请稍后再试'
  if (/row-level security|not authorized|unauthorized|jwt|invalid.*token/.test(text)) {
    return '没有上传权限，请重新登录后再试'
  }
  if (/exceeded|too large|maximum allowed size|payload too large/.test(text)) {
    return '头像不能超过 1MB'
  }
  if (/fetch|network|timeout|timed out/.test(text)) return '网络异常，头像上传失败，请重试'
  return '头像上传失败，请重试'
}

function newAvatarId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid.replace(/-/g, '')
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** 上传处理后的 JPEG，返回可写入资料表的对象路径 */
export async function uploadAvatar(jpeg: Blob): Promise<string> {
  if (!cloudConfigured()) throw new Error('云服务未配置，头像功能暂不可用')
  const client = await getClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('登录已失效，请重新登录')

  const path = avatarStoragePath(user.id, newAvatarId())
  const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(avatarUploadError(error.message))
  return path
}

/** 清理被替换的旧头像；失败不影响资料已更新的结果 */
export async function deleteAvatar(path: string): Promise<void> {
  if (!cloudConfigured()) return
  try {
    const client = await getClient()
    await client.storage.from(AVATAR_BUCKET).remove([path])
  } catch {
    // 旧对象残留只占少量空间，不阻断换头像流程
  }
}
