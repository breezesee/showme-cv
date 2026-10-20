import { isPhotoPath, photoCropRect, type PhotoCropRect } from './photo'

/** 头像：公开桶 + 随机 UUID 路径；只存对象路径，渲染时推导 URL */
export const AVATAR_BUCKET = 'avatars'
export const AVATAR_OUTPUT_SIZE = 320

/** 以 1:1 居中裁剪源图 */
export function avatarCropRect(width: number, height: number): PhotoCropRect {
  return photoCropRect(width, height, 1)
}

/** 输出尺寸：正方形，最长边不超过 320，不放大原图 */
export function avatarOutputSize(croppedWidth: number): { width: number; height: number } {
  const width = Math.max(1, Math.min(AVATAR_OUTPUT_SIZE, Math.round(croppedWidth)))
  return { width, height: width }
}

/** 公开桶 URL：未配置地址或路径非法时返回空串 */
export function avatarUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base || !isPhotoPath(path)) return ''
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`
}
