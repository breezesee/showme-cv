import {
  PHOTO_JPEG_QUALITY,
  photoCropRect,
  photoOutputSize,
} from '../model/photo'

/**
 * 上传前处理：按 EXIF 方向解码，居中裁成 5:7，最长 700×980，统一输出 JPEG。
 * createImageBitmap 的 from-image 会自动应用手机照片的方向。
 */
export async function processPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const crop = photoCropRect(bitmap.width, bitmap.height)
    if (!crop.sw || !crop.sh) throw new Error('照片尺寸异常，请换一张图片')
    const size = photoOutputSize(crop.sw)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('照片处理失败，请换一张图片')
    // 透明 PNG 铺白底，避免转 JPEG 后出现黑块
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size.width, size.height)
    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY)
    })
    if (!jpeg) throw new Error('照片处理失败，请换一张图片')
    return jpeg
  } finally {
    bitmap.close()
  }
}
