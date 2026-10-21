import { describe, expect, it } from 'vitest'
import { buildAuthRedirect, parseAuthCallback } from './authCallback'

describe('parseAuthCallback', () => {
  it('识别密码找回链接', () => {
    expect(
      parseAuthCallback('', '#access_token=abc&refresh_token=def&expires_in=3600&type=recovery'),
    ).toEqual({ kind: 'recovery' })
  })

  it('识别邮箱更换链接', () => {
    expect(
      parseAuthCallback('', '#access_token=abc&refresh_token=def&type=email_change'),
    ).toEqual({ kind: 'email_change' })
  })

  it('用 redirectTo 上的 auth 参数识别失效链接所属流程', () => {
    expect(
      parseAuthCallback(
        '?auth=recovery',
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({
      kind: 'error',
      flow: 'recovery',
      description: '链接已失效',
    })
    expect(
      parseAuthCallback('?auth=email-change', '#error=access_denied&error_code=otp_expired'),
    ).toEqual({ kind: 'error', flow: 'email-change', description: '链接已失效' })
  })

  it('只有流程标记没有令牌时按失效链接处理，不落回编辑页', () => {
    expect(parseAuthCallback('?auth=recovery', '')).toEqual({
      kind: 'error',
      flow: 'recovery',
      description: '链接已失效',
    })
    expect(parseAuthCallback('?auth=email-change', '')).toEqual({
      kind: 'error',
      flow: 'email-change',
      description: '链接已失效',
    })
  })

  it('不把分享链接或普通地址误判为认证回调', () => {
    expect(parseAuthCallback('', '#r=abc&k=def')).toEqual({ kind: 'none' })
    expect(parseAuthCallback('', '')).toEqual({ kind: 'none' })
  })

  it('相对 base 按当前地址解析，回调地址不带尾点', () => {
    expect(buildAuthRedirect('recovery', './', 'https://showme-cv.netlify.app/')).toBe(
      'https://showme-cv.netlify.app/?auth=recovery',
    )
    expect(buildAuthRedirect('email-change', './', 'https://showme-cv.netlify.app/index.html')).toBe(
      'https://showme-cv.netlify.app/?auth=email-change',
    )
    expect(buildAuthRedirect('recovery', '/app/', 'https://example.com/app/')).toBe(
      'https://example.com/app/?auth=recovery',
    )
  })
})
