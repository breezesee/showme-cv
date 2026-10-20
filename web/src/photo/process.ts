import { avatarCropRect, avatarOutputSize } from '../model/avatar'
import {
  PHOTO_JPEG_QUALITY,
  photoCropRect,
  photoOutputSize,
  type PhotoCropRect,
} from '../model/photo'

/**
 * 上传前处理：按 EXIF 方向解码，居中裁剪，限制输出尺寸，统一 JPEG。
 * createImageBitmap 的 from-image 会自动应用手机照片的方向。
 */
async function renderJpeg(
  file: Blob,
  cropOf: (width: number, height: number) => PhotoCropRect,
  sizeOf: (croppedWidth: number) => { width: number; height: number },
  label: string,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const crop = cropOf(bitmap.width, bitmap.height)
    if (!crop.sw || !crop.sh) throw new Error(`${label}尺寸异常，请换一张图片`)
    const size = sizeOf(crop.sw)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(`${label}处理失败，请换一张图片`)
    // 透明 PNG 铺白底，避免转 JPEG 后出现黑块
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size.width, size.height)
    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY)
    })
    if (!jpeg) throw new Error(`${label}处理失败，请换一张图片`)
    return jpeg
  } finally {
    bitmap.close()
  }
}

/** 简历照片：5:7，最长 700×980 */
export function processPhoto(file: Blob): Promise<Blob> {
  return renderJpeg(file, photoCropRect, photoOutputSize, '照片')
}

/** 头像：1:1，最长 320×320 */
export function processAvatar(file: Blob): Promise<Blob> {
  return renderJpeg(file, avatarCropRect, avatarOutputSize, '头像')
}
