import { PHOTO_BUCKET } from '../model/photo'
import { cloudConfigured, getClient } from './client'

/** Storage 对象路径：用户目录 + 随机文件名，扩展名固定 jpg */
export function photoStoragePath(uid: string, id: string): string {
  return `${uid}/${id}.jpg`
}

/** 把 Storage / 网络错误翻译为可操作的中文提示 */
export function photoUploadError(message: string): string {
  const text = message.toLowerCase()
  if (/bucket.*not found|not found/.test(text)) return '照片存储尚未配置，请稍后再试'
  if (/row-level security|not authorized|unauthorized|jwt|invalid.*token/.test(text)) {
    return '没有上传权限，请重新登录后再试'
  }
  if (/exceeded|too large|maximum allowed size|payload too large/.test(text)) {
    return '照片不能超过 2MB'
  }
  if (/fetch|network|timeout|timed out/.test(text)) return '网络异常，照片上传失败，请重试'
  return '照片上传失败，请重试'
}

function newPhotoId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid.replace(/-/g, '')
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** 上传处理后的 JPEG，返回可写入简历的对象路径（不删除旧对象，避免历史分享破图） */
export async function uploadResumePhoto(jpeg: Blob): Promise<string> {
  if (!cloudConfigured()) throw new Error('云服务未配置，照片功能暂不可用')
  const client = await getClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('登录已失效，请重新登录')

  const path = photoStoragePath(user.id, newPhotoId())
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(photoUploadError(error.message))
  return path
}
