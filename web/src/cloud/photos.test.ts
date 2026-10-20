import { describe, expect, it } from 'vitest'
import { photoStoragePath, photoUploadError } from './photos'

const UID = '3f0e8f7a-1111-4c2b-9d3e-1234567890ab'

describe('photoStoragePath', () => {
  it('把 uid 作为单层目录，文件固定为 jpg', () => {
    expect(photoStoragePath(UID, 'a1b2c3')).toBe(`${UID}/a1b2c3.jpg`)
  })
})

describe('photoUploadError', () => {
  it('把常见失败翻译为中文提示', () => {
    expect(photoUploadError('Bucket not found')).toContain('尚未配置')
    expect(photoUploadError('new row violates row-level security policy')).toContain('重新登录')
    expect(photoUploadError('The object exceeded the maximum allowed size')).toContain('2MB')
    expect(photoUploadError('TypeError: Failed to fetch')).toContain('网络')
  })

  it('未知错误给出通用重试提示', () => {
    expect(photoUploadError('something odd')).toBe('照片上传失败，请重试')
  })
})
