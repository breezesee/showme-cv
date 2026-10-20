import { describe, expect, it } from 'vitest'
import { avatarStoragePath, avatarUploadError } from './avatars'

const UID = '3f0e8f7a-1111-4c2b-9d3e-1234567890ab'

describe('avatarStoragePath', () => {
  it('把 uid 作为单层目录，文件固定为 jpg', () => {
    expect(avatarStoragePath(UID, 'a1b2c3')).toBe(`${UID}/a1b2c3.jpg`)
  })
})

describe('avatarUploadError', () => {
  it('把常见失败翻译为中文提示', () => {
    expect(avatarUploadError('Bucket not found')).toContain('头像存储尚未配置')
    expect(avatarUploadError('new row violates row-level security policy')).toContain('重新登录')
    expect(avatarUploadError('The object exceeded the maximum allowed size')).toContain('1MB')
    expect(avatarUploadError('TypeError: Failed to fetch')).toContain('网络')
  })

  it('未知错误给出通用重试提示', () => {
    expect(avatarUploadError('something odd')).toBe('头像上传失败，请重试')
  })
})
