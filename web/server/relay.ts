/**
 * 短码中转接口（与运行环境无关的处理逻辑）。
 * - Netlify Functions（web/netlify/functions/relay.ts）在线上调用；
 * - vite 开发 / 预览服务器用内存 KV 调用，本地即可完整走通。
 *
 * 服务端只保存浏览器端加密后的密文（base64url 文本），不接触密钥，也无法解读内容。
 */

/** KV 存储的最小子集（Netlify Blobs / 内存实现均满足） */
export interface RelayKV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface RelayEnv {
  RELAY: RelayKV
}

export const RELAY_TTL_SECONDS = 7 * 24 * 60 * 60
export const RELAY_TTL_OPTIONS = [7, 30] as const
export type RelayTtlDays = (typeof RELAY_TTL_OPTIONS)[number]
/** 密文上限：含本地照片的简历会明显变大，128KB 仍远低于 KV 限制 */
export const RELAY_MAX_CHARS = 128 * 1024
export const RELAY_ID_LENGTH = 10

const ID_PATTERN = /^[0-9A-Za-z]{10}$/
const BODY_PATTERN = /^[A-Za-z0-9_-]+$/
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const KEY_PREFIX = 'r:'
/** 吊销令牌哈希单独存一条，键与内容同 TTL */
const META_PREFIX = 'm:'
const REVOKE_HEADER = 'X-ShowMe-Revoke'

export function isRelayId(id: string): boolean {
  return ID_PATTERN.test(id)
}

/** 10 位 base62 随机短码（约 59 位熵），拒绝采样避免取模偏差 */
export function newRelayId(): string {
  let id = ''
  while (id.length < RELAY_ID_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && id.length < RELAY_ID_LENGTH) id += BASE62[b % 62]
    }
  }
  return id
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 32 字节随机吊销令牌，只在生成响应中返回一次 */
export function newRevokeToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return toBase64Url(new Uint8Array(digest))
}

/** 长度一致时逐字节异或，避免按字符提前返回 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function parseRelayTtl(value: string | null): RelayTtlDays | null {
  if (value === null) return 7
  const days = Number(value)
  return (RELAY_TTL_OPTIONS as readonly number[]).includes(days) ? (days as RelayTtlDays) : null
}

export async function handleRelayPost(request: Request, env: RelayEnv, now = Date.now()): Promise<Response> {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > RELAY_MAX_CHARS) return json(413, { error: 'too-large' })
  const body = (await request.text()).trim()
  if (body.length > RELAY_MAX_CHARS) return json(413, { error: 'too-large' })
  if (!body || !BODY_PATTERN.test(body)) return json(400, { error: 'bad-body' })

  const ttlDays = parseRelayTtl(new URL(request.url).searchParams.get('ttl'))
  if (ttlDays === null) return json(400, { error: 'bad-ttl' })
  const ttlSeconds = ttlDays * 24 * 60 * 60

  // 不做「先查再写」的碰撞检查：KV 会在边缘缓存「不存在」的查询结果，反而可能让刚写入的短码短时间内读不到；
  // 59 位随机短码在有效期内的碰撞概率可以忽略
  const id = newRelayId()
  const revokeToken = newRevokeToken()
  await env.RELAY.put(KEY_PREFIX + id, body, { expirationTtl: ttlSeconds })
  await env.RELAY.put(META_PREFIX + id, await hashToken(revokeToken), { expirationTtl: ttlSeconds })
  return json(201, { id, expiresAt: now + ttlSeconds * 1000, revokeToken })
}

export async function handleRelayGet(id: string, env: RelayEnv): Promise<Response> {
  if (!isRelayId(id)) return json(404, { error: 'not-found' })
  const body = await env.RELAY.get(KEY_PREFIX + id)
  if (body === null) return json(404, { error: 'not-found' })
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** 提前失效：必须携带生成时返回的吊销令牌 */
export async function handleRelayDelete(id: string, request: Request, env: RelayEnv): Promise<Response> {
  if (!isRelayId(id)) return json(404, { error: 'not-found' })
  const token = (request.headers.get(REVOKE_HEADER) ?? '').trim()
  if (!TOKEN_PATTERN.test(token)) return json(403, { error: 'forbidden' })
  const stored = await env.RELAY.get(META_PREFIX + id)
  if (stored === null) return json(404, { error: 'not-found' })
  if (!safeEqual(stored, await hashToken(token))) return json(403, { error: 'forbidden' })
  await env.RELAY.delete(KEY_PREFIX + id)
  await env.RELAY.delete(META_PREFIX + id)
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

/** 按路径分发：POST /api/relay、GET/DELETE /api/relay/<id>；不匹配返回 null（交给后续处理） */
export async function routeRelay(request: Request, env: RelayEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname
  if (path === '/api/relay') {
    return request.method === 'POST' ? handleRelayPost(request, env) : json(405, { error: 'method' })
  }
  const m = /^\/api\/relay\/([^/]+)$/.exec(path)
  if (m) {
    if (request.method === 'GET') return handleRelayGet(m[1]!, env)
    if (request.method === 'DELETE') return handleRelayDelete(m[1]!, request, env)
    return json(405, { error: 'method' })
  }
  return null
}

/** 本地开发用的内存 KV（按 expirationTtl 过期） */
export function memoryKV(clock: () => number = Date.now): RelayKV & { size(): number } {
  const store = new Map<string, { value: string; expires: number }>()
  return {
    async get(key) {
      const hit = store.get(key)
      if (!hit) return null
      if (hit.expires <= clock()) {
        store.delete(key)
        return null
      }
      return hit.value
    },
    async put(key, value, options) {
      const ttl = options?.expirationTtl ?? Infinity
      store.set(key, { value, expires: clock() + ttl * 1000 })
    },
    async delete(key) {
      store.delete(key)
    },
    size: () => store.size,
  }
}
