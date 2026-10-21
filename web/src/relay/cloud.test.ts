import { describe, expect, it } from 'vitest'
import { memoryKV, routeRelay, RELAY_MAX_CHARS, RELAY_TTL_SECONDS, type RelayEnv } from '../../server/relay'
import { sampleResume } from '../model/resume'
import {
  CloudRelayError,
  createShortLink,
  fetchShortLink,
  openResume,
  revokeShortLink,
  sealResume,
} from './cloud'
import { parseRelayHash } from './link'

const PAGE = 'https://showme-cv.netlify.app/'

/** 用内存 KV 跑真实的中转处理逻辑，充当 fetch */
function fakeServer(clock: () => number = Date.now) {
  const kv = memoryKV(clock)
  const env: RelayEnv = { RELAY: kv }
  const stored: string[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    if (request.method === 'POST') stored.push(await request.clone().text())
    return (await routeRelay(request, env)) ?? new Response('', { status: 404 })
  }) as typeof fetch
  return { kv, fetchImpl, stored }
}

const noWait = async () => {}

async function errorOf(p: Promise<unknown>): Promise<CloudRelayError> {
  try {
    await p
  } catch (e) {
    if (e instanceof CloudRelayError) return e
    throw e
  }
  throw new Error('expected CloudRelayError')
}

describe('短码中转：加解密', () => {
  it('往返一致，外观与权限随简历一起传输', async () => {
    const r = sampleResume()
    r.basics.name = '张三 <b>&</b> 🚀'
    const { payload, key } = await sealResume(r, { templateId: 'air', themeId: 'dusk' })
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await openResume(payload, key)).toEqual({
      resume: r,
      look: { templateId: 'air', themeId: 'dusk' },
      permission: 'edit',
    })
    // 不带外观时解出纯简历
    const plain = await sealResume(r)
    expect(await openResume(plain.payload, plain.key)).toEqual({ resume: r, permission: 'edit' })
  })

  it('仅查看权限随密文往返', async () => {
    const r = sampleResume()
    const sealed = await sealResume(r, { themeId: 'mint' }, 'view')
    expect(await openResume(sealed.payload, sealed.key)).toEqual({
      resume: r,
      look: { themeId: 'mint' },
      permission: 'view',
    })
  })

  it('密钥错误或密文被篡改判为损坏', async () => {
    const { payload, key } = await sealResume(sampleResume())
    const other = (await sealResume(sampleResume())).key
    expect((await errorOf(openResume(payload, other))).kind).toBe('broken')
    const flipped = payload.slice(0, 30) + (payload[30] === 'A' ? 'B' : 'A') + payload.slice(31)
    expect((await errorOf(openResume(flipped, key))).kind).toBe('broken')
  })

  it('同一份简历每次加密的密文都不同', async () => {
    const a = await sealResume(sampleResume())
    const b = await sealResume(sampleResume())
    expect(a.payload).not.toBe(b.payload)
  })
})

describe('短码中转：端到端', () => {
  it('生成短链接 → 另一端取回，内容、外观与权限一致，服务器只有密文', async () => {
    const server = fakeServer()
    const r = sampleResume()
    const look = { templateId: 'duo', themeId: 'rose' } as const
    const link = await createShortLink(r, PAGE + '#old', look, 'view', { fetchImpl: server.fetchImpl })
    expect(link.url.length).toBeLessThan(120)
    const parsed = parseRelayHash(new URL(link.url).hash)
    if (parsed.kind !== 'cloud') throw new Error(parsed.kind)
    expect(await fetchShortLink(parsed.id, parsed.key, link.url, server.fetchImpl, noWait)).toEqual({
      resume: r,
      look,
      permission: 'view',
    })

    expect(server.stored).toHaveLength(1)
    expect(server.stored[0]).not.toContain(parsed.key)
    expect(server.stored[0]).not.toContain(r.basics.name)
  })

  it('短码不存在：重试后判为过期', async () => {
    const server = fakeServer()
    const waits: number[] = []
    const e = await errorOf(
      fetchShortLink('a1B2c3D4e5', 'AbCdEfGhIjKlMnOpQr_-12', PAGE, server.fetchImpl, async (ms) => void waits.push(ms)),
    )
    expect(e.kind).toBe('expired')
    expect(waits).toHaveLength(3)
  })

  it('默认 7 天后过期', async () => {
    let now = 1_000_000
    const server = fakeServer(() => now)
    const link = await createShortLink(sampleResume(), PAGE, undefined, 'edit', { fetchImpl: server.fetchImpl })
    expect(link.ttlDays).toBe(7)
    const parsed = parseRelayHash(new URL(link.url).hash)
    if (parsed.kind !== 'cloud') throw new Error(parsed.kind)
    now += RELAY_TTL_SECONDS * 1000 - 1
    await fetchShortLink(parsed.id, parsed.key, PAGE, server.fetchImpl, noWait)
    now += 2
    expect((await errorOf(fetchShortLink(parsed.id, parsed.key, PAGE, server.fetchImpl, noWait))).kind).toBe('expired')
  })

  it('可选 30 天有效', async () => {
    let now = 1_000_000
    const server = fakeServer(() => now)
    const link = await createShortLink(sampleResume(), PAGE, undefined, 'view', {
      ttlDays: 30,
      fetchImpl: server.fetchImpl,
    })
    expect(link.ttlDays).toBe(30)
    const parsed = parseRelayHash(new URL(link.url).hash)
    if (parsed.kind !== 'cloud') throw new Error(parsed.kind)
    now += 29 * 24 * 60 * 60 * 1000
    await fetchShortLink(parsed.id, parsed.key, PAGE, server.fetchImpl, noWait)
    now += 2 * 24 * 60 * 60 * 1000
    expect((await errorOf(fetchShortLink(parsed.id, parsed.key, PAGE, server.fetchImpl, noWait))).kind).toBe('expired')
  })

  it('持吊销凭证可立即失效；错误凭证被拒绝', async () => {
    const server = fakeServer()
    const link = await createShortLink(sampleResume(), PAGE, undefined, 'view', { fetchImpl: server.fetchImpl })
    expect(link.revokeToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const parsed = parseRelayHash(new URL(link.url).hash)
    if (parsed.kind !== 'cloud') throw new Error(parsed.kind)

    expect(
      (await errorOf(revokeShortLink(link.id, 'A'.repeat(43), PAGE, server.fetchImpl))).kind,
    ).toBe('forbidden')
    await fetchShortLink(parsed.id, parsed.key, PAGE, server.fetchImpl, noWait)

    await revokeShortLink(link.id, link.revokeToken, PAGE, server.fetchImpl)
    expect((await errorOf(fetchShortLink(parsed.id, parsed.key, PAGE, server.fetchImpl, noWait))).kind).toBe('expired')
    expect((await errorOf(revokeShortLink(link.id, link.revokeToken, PAGE, server.fetchImpl))).kind).toBe('expired')
  })

  it('网络失败与服务异常', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(
      (await errorOf(createShortLink(sampleResume(), PAGE, undefined, 'edit', { fetchImpl: offline }))).kind,
    ).toBe('network')
    expect((await errorOf(fetchShortLink('a1B2c3D4e5', 'k'.repeat(22), PAGE, offline, noWait))).kind).toBe('network')
    expect(
      (await errorOf(revokeShortLink('a1B2c3D4e5', 'A'.repeat(43), PAGE, offline))).kind,
    ).toBe('network')

    // 未部署中转时，静态托管通常返回首页 HTML
    const html = (async () => new Response('<!doctype html>', { status: 200 })) as typeof fetch
    expect(
      (await errorOf(createShortLink(sampleResume(), PAGE, undefined, 'edit', { fetchImpl: html }))).kind,
    ).toBe('server')
  })
})

describe('中转接口', () => {
  const env = (): RelayEnv => ({ RELAY: memoryKV() })
  const post = (body: string) => new Request('https://x/api/relay', { method: 'POST', body })

  it('拒绝空、非法与超长的正文', async () => {
    const e = env()
    expect((await routeRelay(post(''), e))?.status).toBe(400)
    expect((await routeRelay(post('<script>'), e))?.status).toBe(400)
    expect((await routeRelay(post('a'.repeat(RELAY_MAX_CHARS + 1)), e))?.status).toBe(413)
  })

  it('非法短码与错误方法', async () => {
    const e = env()
    expect((await routeRelay(new Request('https://x/api/relay/a1B2c3D4e5%21'), e))?.status).toBe(404)
    expect((await routeRelay(new Request('https://x/api/relay/short'), e))?.status).toBe(404)
    expect((await routeRelay(new Request('https://x/api/relay'), e))?.status).toBe(405)
    expect((await routeRelay(new Request('https://x/api/relay/a1B2c3D4e5', { method: 'PUT' }), e))?.status).toBe(405)
    // 缺少吊销令牌
    expect((await routeRelay(new Request('https://x/api/relay/a1B2c3D4e5', { method: 'DELETE' }), e))?.status).toBe(403)
    expect(await routeRelay(new Request('https://x/index.html'), e)).toBeNull()
  })

  it('非法有效期被拒绝', async () => {
    for (const ttl of ['1', '365', 'abc', '']) {
      const res = await routeRelay(new Request(`https://x/api/relay?ttl=${ttl}`, { method: 'POST', body: 'abc' }), env())
      expect(res?.status).toBe(400)
    }
  })

  it('响应禁止缓存', async () => {
    const res = await routeRelay(post('abc'), env())
    expect(res?.status).toBe(201)
    expect(res?.headers.get('Cache-Control')).toBe('no-store')
  })
})
