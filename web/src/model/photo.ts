/** 照片：只存 Storage 对象路径；页面渲染时据此推导公开 URL */
export const PHOTO_BUCKET = 'resume-photos'
export const PHOTO_ASPECT = 5 / 7
export const PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024
export const PHOTO_MAX_WIDTH = 700
export const PHOTO_JPEG_QUALITY = 0.86
export const PHOTO_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** ${uid}/${uuid}.jpg：单层目录，拒绝完整 URL、路径穿越与多级路径 */
const PHOTO_PATH_RE = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.(?:jpg|jpeg|png|webp)$/

export function isPhotoPath(value: unknown): value is string {
  return typeof value === 'string' && PHOTO_PATH_RE.test(value)
}

/** 公开桶 URL：不把部署地址写进简历，渲染时由环境推导 */
export function photoUrl(baseUrl: string, path: string): string {
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

export function validatePhotoFile(file: { type: string; size: number } | null | undefined): string | null {
  if (!file || file.size <= 0) return '图片文件为空，请重新选择'
  if (!(PHOTO_INPUT_TYPES as readonly string[]).includes(file.type)) return '仅支持 JPG、PNG、WebP 图片'
  if (file.size > PHOTO_MAX_INPUT_BYTES) return '图片不能超过 10MB'
  return null
}
