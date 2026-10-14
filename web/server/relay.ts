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
}

export interface RelayEnv {
  RELAY: RelayKV
}

export const RELAY_TTL_SECONDS = 7 * 24 * 60 * 60
/** 密文上限：示例规模的简历密文约 1–2KB，64KB 足够容纳很长的简历 */
export const RELAY_MAX_CHARS = 64 * 1024
export const RELAY_ID_LENGTH = 10

const ID_PATTERN = /^[0-9A-Za-z]{10}$/
const BODY_PATTERN = /^[A-Za-z0-9_-]+$/
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const KEY_PREFIX = 'r:'

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

export async function handleRelayPost(request: Request, env: RelayEnv, now = Date.now()): Promise<Response> {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > RELAY_MAX_CHARS) return json(413, { error: 'too-large' })
  const body = (await request.text()).trim()
  if (body.length > RELAY_MAX_CHARS) return json(413, { error: 'too-large' })
  if (!body || !BODY_PATTERN.test(body)) return json(400, { error: 'bad-body' })

  // 不做「先查再写」的碰撞检查：KV 会在边缘缓存「不存在」的查询结果，反而可能让刚写入的短码短时间内读不到；
  // 59 位随机短码在 7 天有效期内的碰撞概率可以忽略
  const id = newRelayId()
  await env.RELAY.put(KEY_PREFIX + id, body, { expirationTtl: RELAY_TTL_SECONDS })
  return json(201, { id, expiresAt: now + RELAY_TTL_SECONDS * 1000 })
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

/** 按路径分发：POST /api/relay、GET /api/relay/<id>；不匹配返回 null（交给后续处理） */
export async function routeRelay(request: Request, env: RelayEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname
  if (path === '/api/relay') {
    return request.method === 'POST' ? handleRelayPost(request, env) : json(405, { error: 'method' })
  }
  const m = /^\/api\/relay\/([^/]+)$/.exec(path)
  if (m) return request.method === 'GET' ? handleRelayGet(m[1], env) : json(405, { error: 'method' })
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
    size: () => store.size,
  }
}
