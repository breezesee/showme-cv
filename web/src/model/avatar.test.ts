import { describe, expect, it } from 'vitest'
import { AVATAR_OUTPUT_SIZE, avatarCropRect, avatarOutputSize, avatarUrl } from './avatar'

const UID = '3f0e8f7a-1111-4c2b-9d3e-1234567890ab'
const ID = 'a1b2c3d4-2222-4e5f-8a9b-abcdefabcdef'

describe('avatarCropRect', () => {
  it('宽图裁掉左右，保持 1:1 居中', () => {
    expect(avatarCropRect(1000, 800)).toEqual({ sx: 100, sy: 0, sw: 800, sh: 800 })
  })

  it('高图裁掉上下，保持 1:1 居中', () => {
    expect(avatarCropRect(800, 1000)).toEqual({ sx: 0, sy: 100, sw: 800, sh: 800 })
  })

  it('非法尺寸返回零矩形', () => {
    expect(avatarCropRect(0, 100)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 })
  })
})

describe('avatarOutputSize', () => {
  it('最长边不超过 320，且不放大原图', () => {
    expect(AVATAR_OUTPUT_SIZE).toBe(320)
    expect(avatarOutputSize(2000)).toEqual({ width: 320, height: 320 })
    expect(avatarOutputSize(200)).toEqual({ width: 200, height: 200 })
    expect(avatarOutputSize(1)).toEqual({ width: 1, height: 1 })
  })
})

describe('avatarUrl', () => {
  it('拼接 avatars 公开桶 URL', () => {
    expect(avatarUrl('https://demo.supabase.co/', `${UID}/${ID}.jpg`)).toBe(
      `https://demo.supabase.co/storage/v1/object/public/avatars/${UID}/${ID}.jpg`,
    )
  })

  it('未配置地址或路径非法时返回空串', () => {
    expect(avatarUrl('', `${UID}/${ID}.jpg`)).toBe('')
    expect(avatarUrl('https://demo.supabase.co', 'https://evil.example/x.jpg')).toBe('')
  })
})
