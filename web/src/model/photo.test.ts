import { describe, expect, it } from 'vitest'
import {
  PHOTO_MAX_INPUT_BYTES,
  isPhotoPath,
  photoCropRect,
  photoOutputSize,
  photoUrl,
  validatePhotoFile,
} from './photo'

const UID = '3f0e8f7a-1111-4c2b-9d3e-1234567890ab'
const ID = 'a1b2c3d4-2222-4e5f-8a9b-abcdefabcdef'

describe('isPhotoPath', () => {
  it('接受 uid/uuid.jpg', () => {
    expect(isPhotoPath(`${UID}/${ID}.jpg`)).toBe(true)
    expect(isPhotoPath(`${UID}/${ID}.jpeg`)).toBe(true)
    expect(isPhotoPath(`${UID}/${ID}.png`)).toBe(true)
    expect(isPhotoPath(`${UID}/${ID}.webp`)).toBe(true)
  })

  it('拒绝完整 URL、路径穿越、多级目录与未知扩展名', () => {
    expect(isPhotoPath(`https://x.supabase.co/storage/v1/object/public/resume-photos/${UID}/${ID}.jpg`)).toBe(false)
    expect(isPhotoPath(`../${ID}.jpg`)).toBe(false)
    expect(isPhotoPath(`${UID}/../${ID}.jpg`)).toBe(false)
    expect(isPhotoPath(`${UID}/nested/${ID}.jpg`)).toBe(false)
    expect(isPhotoPath(`${UID}/${ID}.gif`)).toBe(false)
    expect(isPhotoPath('')).toBe(false)
    expect(isPhotoPath(null)).toBe(false)
  })
})

describe('photoCropRect', () => {
  it('宽图裁掉左右，保持 5:7 居中', () => {
    const r = photoCropRect(1000, 1000)
    expect(r.sw).toBeCloseTo(714.2857, 3)
    expect(r.sh).toBe(1000)
    expect(r.sx).toBeCloseTo(142.8571, 3)
    expect(r.sy).toBe(0)
  })

  it('高图裁掉上下', () => {
    expect(photoCropRect(700, 1400)).toEqual({ sx: 0, sy: 210, sw: 700, sh: 980 })
  })

  it('正好 5:7 不裁剪', () => {
    expect(photoCropRect(500, 700)).toEqual({ sx: 0, sy: 0, sw: 500, sh: 700 })
  })

  it('非法尺寸返回零矩形', () => {
    expect(photoCropRect(0, 100)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 })
    expect(photoCropRect(100, -1)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 })
  })
})

describe('photoOutputSize', () => {
  it('最小边不放大，最长输出 700×980', () => {
    expect(photoOutputSize(2000)).toEqual({ width: 700, height: 980 })
    expect(photoOutputSize(700)).toEqual({ width: 700, height: 980 })
  })

  it('小图按原宽等比输出', () => {
    expect(photoOutputSize(320)).toEqual({ width: 320, height: 448 })
    expect(photoOutputSize(1)).toEqual({ width: 1, height: 1 })
  })
})

describe('photoUrl', () => {
  it('拼接公开桶 URL，容忍部署地址末尾斜杠', () => {
    expect(photoUrl('https://demo.supabase.co/', `${UID}/${ID}.jpg`)).toBe(
      `https://demo.supabase.co/storage/v1/object/public/resume-photos/${UID}/${ID}.jpg`,
    )
    expect(photoUrl('https://demo.supabase.co', `${UID}/${ID}.jpg`)).toBe(
      `https://demo.supabase.co/storage/v1/object/public/resume-photos/${UID}/${ID}.jpg`,
    )
  })

  it('未配置地址或路径非法时返回空串', () => {
    expect(photoUrl('', `${UID}/${ID}.jpg`)).toBe('')
    expect(photoUrl('https://demo.supabase.co', 'https://evil.example/x.jpg')).toBe('')
    expect(photoUrl('https://demo.supabase.co', `../${ID}.jpg`)).toBe('')
  })
})

describe('validatePhotoFile', () => {
  it('接受 JPG / PNG / WebP 且不超过 10MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validatePhotoFile({ type, size: 1024 })).toBeNull()
    }
    expect(PHOTO_MAX_INPUT_BYTES).toBe(10 * 1024 * 1024)
  })

  it('拒绝其他格式与空文件', () => {
    expect(validatePhotoFile({ type: 'image/gif', size: 1024 })).toContain('JPG')
    expect(validatePhotoFile({ type: 'image/jpeg', size: 0 })).toContain('空')
  })

  it('拒绝超过 10MB', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: PHOTO_MAX_INPUT_BYTES + 1 })).toContain('10MB')
  })
})
