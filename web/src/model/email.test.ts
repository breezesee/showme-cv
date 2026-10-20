import { describe, expect, it } from 'vitest'
import { emailError, normalizeEmail } from './email'

const FORMAT = '邮箱格式不正确，例如 name@example.com'

describe('emailError', () => {
  it('空值给出明确提示', () => {
    expect(emailError('')).toBe('请输入邮箱')
    expect(emailError('   ')).toBe('请输入邮箱')
  })

  it('接受常见邮箱格式', () => {
    for (const email of [
      'a@b.co',
      'xiaoming.li@outlook.com',
      'a+b@sub.example.com',
      '用户@例子.公司',
    ]) {
      expect(emailError(email)).toBeNull()
    }
  })

  it('校验时忽略首尾空白', () => {
    expect(emailError('  a@b.co  ')).toBeNull()
  })

  it('拒绝缺少 @、域名或域名点号', () => {
    expect(emailError('abc')).toBe(FORMAT)
    expect(emailError('a@')).toBe(FORMAT)
    expect(emailError('@example.com')).toBe(FORMAT)
    expect(emailError('a@example')).toBe(FORMAT)
  })

  it('拒绝空格、多个 @ 与首尾点 / 连续点', () => {
    expect(emailError('a b@example.com')).toBe(FORMAT)
    expect(emailError('a@b@example.com')).toBe(FORMAT)
    expect(emailError('.a@example.com')).toBe(FORMAT)
    expect(emailError('a.@example.com')).toBe(FORMAT)
    expect(emailError('a..b@example.com')).toBe(FORMAT)
    expect(emailError('a@.example.com')).toBe(FORMAT)
    expect(emailError('a@example..com')).toBe(FORMAT)
    expect(emailError('a@example.com.')).toBe(FORMAT)
  })

  it('拒绝超长邮箱', () => {
    expect(emailError(`${'a'.repeat(243)}@example.com`)).toBe('邮箱过长')
  })
})

describe('normalizeEmail', () => {
  it('只去除首尾空白，保留大小写', () => {
    expect(normalizeEmail('  Alex@Example.com ')).toBe('Alex@Example.com')
  })
})
