import { describe, expect, it } from 'vitest'
import { isAdminMetadata, readAdminIdentity } from './adminAuth'

describe('isAdminMetadata', () => {
  it('只有 app_metadata.role === admin 才算管理员', () => {
    expect(isAdminMetadata({ role: 'admin' })).toBe(true)
    expect(isAdminMetadata({ role: 'user' })).toBe(false)
    expect(isAdminMetadata({})).toBe(false)
  })

  it('非对象与异常值一律拒绝', () => {
    expect(isAdminMetadata(null)).toBe(false)
    expect(isAdminMetadata(undefined)).toBe(false)
    expect(isAdminMetadata('admin')).toBe(false)
    expect(isAdminMetadata(['admin'])).toBe(false)
    expect(isAdminMetadata({ role: ['admin'] })).toBe(false)
  })
})

describe('readAdminIdentity', () => {
  it('读取 id、邮箱与管理员身份', () => {
    expect(
      readAdminIdentity({
        id: 'u-1',
        email: 'admin@example.com',
        app_metadata: { role: 'admin' },
      }),
    ).toEqual({ id: 'u-1', email: 'admin@example.com', isAdmin: true })
  })

  it('user_metadata 里的 role 不参与判定', () => {
    expect(
      readAdminIdentity({
        id: 'u-2',
        email: 'someone@example.com',
        app_metadata: {},
        user_metadata: { role: 'admin' },
      }),
    ).toEqual({ id: 'u-2', email: 'someone@example.com', isAdmin: false })
  })

  it('缺少 id 视为无有效身份', () => {
    expect(readAdminIdentity(null)).toBeNull()
    expect(readAdminIdentity({})).toBeNull()
    expect(readAdminIdentity({ id: '' })).toBeNull()
    expect(readAdminIdentity({ id: 42 })).toBeNull()
  })

  it('邮箱缺失时返回空串', () => {
    expect(readAdminIdentity({ id: 'u-3' })).toEqual({ id: 'u-3', email: '', isAdmin: false })
  })
})
