/**
 * 照片：Storage 对象路径（登录上传）或内联 data URL（未登录/离线）。
 * 页面渲染时路径据此推导公开 URL，data URL 直接使用。
 */
export const PHOTO_BUCKET = 'resume-photos'
export const PHOTO_ASPECT = 5 / 7
export const PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024
export const PHOTO_MAX_WIDTH = 700
export const PHOTO_JPEG_QUALITY = 0.86
/** 未登录本地照片：更小的尺寸，避免 JSON 备份与分享密文过大 */
export const PHOTO_LOCAL_MAX_WIDTH = 480
export const PHOTO_LOCAL_JPEG_QUALITY = 0.8
/** data URL 字符数上限（约 225KB 二进制） */
export const PHOTO_MAX_DATA_CHARS = 300_000
export const PHOTO_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** ${uid}/${uuid}.jpg：单层目录，拒绝完整 URL、路径穿越与多级路径 */
const PHOTO_PATH_RE = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.(?:jpg|jpeg|png|webp)$/
const PHOTO_DATA_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export function isPhotoPath(value: unknown): value is string {
  return typeof value === 'string' && PHOTO_PATH_RE.test(value)
}

/** 只接受前端生成的 JPEG/PNG/WebP data URL，并限制长度 */
export function isPhotoDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= PHOTO_MAX_DATA_CHARS &&
    PHOTO_DATA_RE.test(value)
  )
}

/** 简历里的照片值：Storage 路径或本地 data URL */
export function isPhotoValue(value: unknown): value is string {
  return isPhotoPath(value) || isPhotoDataUrl(value)
}

/** 公开桶 URL：不把部署地址写进简历，渲染时由环境推导；data URL 直接返回 */
export function photoUrl(baseUrl: string, path: string): string {
  if (isPhotoDataUrl(path)) return path
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base || !isPhotoPath(path)) return ''
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
}

export interface PhotoCropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/** 以 5:7 居中裁剪源图 */
export function photoCropRect(width: number, height: number, aspect = PHOTO_ASPECT): PhotoCropRect {
  if (!(width > 0) || !(height > 0) || !(aspect > 0)) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 }
  }
  let sw = width
  let sh = height
  if (width / height > aspect) sw = height * aspect
  else sh = width / aspect
  return { sx: (width - sw) / 2, sy: (height - sh) / 2, sw, sh }
}

/** 输出尺寸：不放大原图，最长 700×980 */
export function photoOutputSize(croppedWidth: number): { width: number; height: number } {
  const width = Math.max(1, Math.min(PHOTO_MAX_WIDTH, Math.round(croppedWidth)))
  const height = Math.max(1, Math.round(width / PHOTO_ASPECT))
  return { width, height }
}

/** 本地照片输出尺寸：不放大原图，最长 480×672 */
export function photoLocalOutputSize(croppedWidth: number): { width: number; height: number } {
  const width = Math.max(1, Math.min(PHOTO_LOCAL_MAX_WIDTH, Math.round(croppedWidth)))
  const height = Math.max(1, Math.round(width / PHOTO_ASPECT))
  return { width, height }
}

export function validatePhotoFile(file: { type: string; size: number } | null | undefined): string | null {
  if (!file || file.size <= 0) return '图片文件为空，请重新选择'
  if (!(PHOTO_INPUT_TYPES as readonly string[]).includes(file.type)) return '仅支持 JPG、PNG、WebP 图片'
  if (file.size > PHOTO_MAX_INPUT_BYTES) return '图片不能超过 10MB'
  return null
}
