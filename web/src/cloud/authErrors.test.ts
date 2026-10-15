import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './authErrors'

const err = (code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(code), { code, ...extra })

describe('authErrorMessage', () => {
  it.each([
    ['invalid_credentials', '邮箱或密码不正确'],
    ['user_already_exists', '该邮箱已注册，请直接登录'],
    ['email_exists', '该邮箱已注册，请直接登录'],
    ['weak_password', '密码太简单，至少 6 位'],
    ['email_address_invalid', '邮箱格式不正确'],
    ['validation_failed', '邮箱格式不正确'],
    ['over_request_rate_limit', '操作太频繁，请稍后再试'],
    ['over_email_send_rate_limit', '操作太频繁，请稍后再试'],
    ['email_not_confirmed', '该邮箱尚未验证'],
  ])('%s → %s', (code, msg) => {
    expect(authErrorMessage(err(code))).toBe(msg)
  })

  it('网络错误', () => {
    expect(authErrorMessage(Object.assign(new Error('x'), { name: 'AuthRetryableFetchError' }))).toBe('网络异常，请稍后重试')
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe('网络异常，请稍后重试')
    expect(authErrorMessage(err('', { status: 0 }))).toBe('网络异常，请稍后重试')
  })

  it('未知错误兜底', () => {
    expect(authErrorMessage(err('something_new'))).toBe('操作失败，请稍后重试')
    expect(authErrorMessage('boom')).toBe('操作失败，请稍后重试')
    expect(authErrorMessage(null)).toBe('操作失败，请稍后重试')
  })
})
