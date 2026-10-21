/**
 * Netlify 函数适配层测试：mock 掉 @netlify/blobs，验证
 * - config 路由下 POST 存密文 → GET 取回密文；
 * - Blobs 无原生 TTL，懒过期（值内嵌 exp，过期后读到 null）；
 * - 方法与路径校验复用 routeRelay 的行为（405 / 404）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** 内存版 Blobs store：与 getStore('relay') 同名共享 */
const backing = new Map<string, string>()

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    async get(key: string, options?: { type?: string }) {
      const raw = backing.get(key)
      if (raw === undefined) return null
      return options?.type === 'json' ? JSON.parse(raw) : raw
    },
    async set(key: string, value: string) {
      backing.set(key, value)
    },
    async delete(key: string) {
      backing.delete(key)
    },
  }),
}))

const handler = (await import('../../netlify/functions/relay')).default

const post = (body: string, query = '') =>
  handler(new Request(`https://showme.netlify.app/api/relay${query}`, { method: 'POST', body }))
const get = (id: string) =>
  handler(new Request(`https://showme.netlify.app/api/relay/${id}`, { method: 'GET' }))
const del = (id: string, token?: string) =>
  handler(
    new Request(`https://showme.netlify.app/api/relay/${id}`, {
      method: 'DELETE',
      headers: token ? { 'X-ShowMe-Revoke': token } : {},
    }),
  )

describe('netlify 短码中转函数', () => {
  beforeEach(() => {
    backing.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('POST 存入返回 201 和短码，GET 取回原文', async () => {
    const created = await post('dGVzdC1jaXBoZXJ0ZXh0XzEyMw')
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    expect(id).toMatch(/^[0-9A-Za-z]{10}$/)

    const fetched = await get(id)
    expect(fetched.status).toBe(200)
    expect(await fetched.text()).toBe('dGVzdC1jaXBoZXJ0ZXh0XzEyMw')
  })

  it('存储值内嵌过期时间，默认 7 天后懒过期返回 404', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T10:00:00Z'))
    const created = await post('fresh-ciphertext')
    const { id } = (await created.json()) as { id: string }
    expect(await (await get(id)).status).toBe(200)

    vi.setSystemTime(new Date('2026-10-20T10:00:01Z'))
    expect(await (await get(id)).status).toBe(404)
  })

  it('可选 30 天：29 天仍可读，31 天过期', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T10:00:00Z'))
    const created = await post('long-lived', '?ttl=30')
    const { id, revokeToken } = (await created.json()) as { id: string; revokeToken: string }
    expect(revokeToken).toMatch(/^[A-Za-z0-9_-]{43}$/)

    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'))
    expect((await get(id)).status).toBe(200)
    vi.setSystemTime(new Date('2026-11-13T10:00:01Z'))
    expect((await get(id)).status).toBe(404)
  })

  it('吊销：错误令牌 403，正确令牌 204 后立即 404', async () => {
    const created = await post('revocable')
    const { id, revokeToken } = (await created.json()) as { id: string; revokeToken: string }
    expect((await del(id, 'A'.repeat(43))).status).toBe(403)
    expect((await del(id)).status).toBe(403)
    expect((await get(id)).status).toBe(200)

    expect((await del(id, revokeToken)).status).toBe(204)
    expect((await get(id)).status).toBe(404)
    expect((await del(id, revokeToken)).status).toBe(404)
  })

  it('未知短码 404、非法请求体 400、非法 TTL 400、不支持的方法 405、未配置路径 404', async () => {
    expect((await get('zzzzzzzzzz')).status).toBe(404)
    expect((await post('空格 不合法!')).status).toBe(400)
    expect((await post('abc', '?ttl=9')).status).toBe(400)
    expect(
      await handler(new Request('https://showme.netlify.app/api/relay', { method: 'PUT' })),
    ).toMatchObject({ status: 405 })
    expect(await handler(new Request('https://showme.netlify.app/other', { method: 'GET' }))).toMatchObject({
      status: 404,
    })
  })
})
