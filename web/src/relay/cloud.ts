import { compressToUint8Array, decompressFromUint8Array } from 'lz-string'
import type { Resume } from '../model/resume'
import { buildShortUrl, decodeRelayData, encodeRelayData, type RelayLook, type RelayPayload, type SharePermission } from './link'

/**
 * 短码分享（二维码主路径）：浏览器端加密 → 上传密文换短码 → 链接只含短码与密钥。
 * 链接格式 #s=1.<短码>.<密钥>（见 ./link.ts），密钥只在 hash 中，从不发给服务器；服务端只存密文，7/30 天过期。
 * 密文 = base64url( IV(12 字节) || AES-GCM-128( lz-string 压缩的接力数据 JSON，含简历与外观 ) )
 */
const SHORT_ID_PATTERN = /^[0-9A-Za-z]{10}$/
const IV_BYTES = 12
/** 跨地区的 KV 写入可能要几秒才可见：取回时 404 先重试，再判为过期 */
const NOT_FOUND_RETRY_MS = [1000, 2500, 5000]

export type CloudErrorKind = 'unsupported' | 'network' | 'server' | 'expired' | 'broken' | 'forbidden'

export class CloudRelayError extends Error {
  constructor(readonly kind: CloudErrorKind, message: string) {
    super(message)
    this.name = 'CloudRelayError'
  }
}

export function cloudSupported(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.subtle.encrypt === 'function'
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** 加密简历（含外观与访问权限），返回上传用的密文与放进链接的密钥 */
export async function sealResume(
  resume: Resume,
  look?: RelayLook,
  permission: SharePermission = 'edit',
): Promise<{ payload: string; key: string }> {
  const cryptoKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', cryptoKey))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plain = new Uint8Array(compressToUint8Array(encodeRelayData(resume, look, permission)))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plain))
  const packed = new Uint8Array(IV_BYTES + sealed.length)
  packed.set(iv)
  packed.set(sealed, IV_BYTES)
  return { payload: toBase64Url(packed), key: toBase64Url(raw) }
}

/** 解密并校验；密钥不对、数据被篡改或不是简历结构时抛 broken */
export async function openResume(payload: string, key: string): Promise<RelayPayload> {
  try {
    const packed = fromBase64Url(payload.trim())
    const cryptoKey = await crypto.subtle.importKey('raw', fromBase64Url(key), { name: 'AES-GCM' }, false, ['decrypt'])
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(0, IV_BYTES) },
      cryptoKey,
      packed.slice(IV_BYTES),
    )
    const json = decompressFromUint8Array(new Uint8Array(plain))
    if (!json) throw new Error('empty')
    return decodeRelayData(JSON.parse(json))
  } catch {
    throw new CloudRelayError('broken', '链接已损坏')
  }
}

/** 中转接口地址；站点部署在根路径（Netlify），接口固定为 /api/relay */
function apiUrl(origin: string, id?: string): string {
  return new URL(id ? `/api/relay/${id}` : '/api/relay', origin).toString()
}

/** 链接有效期（天）；与 server/relay.ts 的 RELAY_TTL_OPTIONS 保持一致 */
export const SHORT_LINK_TTLS = [7, 30] as const
export type ShortLinkTtl = (typeof SHORT_LINK_TTLS)[number]

export interface ShortLink {
  url: string
  expiresAt: number
  id: string
  /** 提前失效凭证；服务端只保存其哈希 */
  revokeToken: string
  ttlDays: ShortLinkTtl
}

export interface CreateShortLinkOptions {
  ttlDays?: ShortLinkTtl
  fetchImpl?: typeof fetch
}

/** 加密并上传，返回短链接与吊销凭证 */
export async function createShortLink(
  resume: Resume,
  pageUrl: string,
  look?: RelayLook,
  permission: SharePermission = 'edit',
  options: CreateShortLinkOptions = {},
): Promise<ShortLink> {
  if (!cloudSupported()) throw new CloudRelayError('unsupported', '当前环境不支持加密（需 https 访问）')
  const ttlDays = options.ttlDays ?? 7
  const fetchImpl = options.fetchImpl ?? fetch
  const { payload, key } = await sealResume(resume, look, permission)
  let res: Response
  try {
    const url = new URL(apiUrl(pageUrl))
    url.searchParams.set('ttl', String(ttlDays))
    res = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
    })
  } catch {
    throw new CloudRelayError('network', '网络连接失败')
  }
  const data = (await res.json().catch(() => null)) as
    | { id?: unknown; expiresAt?: unknown; revokeToken?: unknown }
    | null
  if (!res.ok || !data || typeof data.id !== 'string' || !SHORT_ID_PATTERN.test(data.id)) {
    throw new CloudRelayError('server', `中转服务不可用（HTTP ${res.status}）`)
  }
  const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : Date.now()
  const revokeToken = typeof data.revokeToken === 'string' ? data.revokeToken : ''
  return { url: buildShortUrl(pageUrl, data.id, key), expiresAt, id: data.id, revokeToken, ttlDays }
}

/** 提前让链接失效；令牌错误或链接已不存在时抛出可直接展示的错误 */
export async function revokeShortLink(
  id: string,
  revokeToken: string,
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let res: Response
  try {
    res = await fetchImpl(apiUrl(pageUrl, id), {
      method: 'DELETE',
      headers: { 'X-ShowMe-Revoke': revokeToken },
      cache: 'no-store',
    })
  } catch {
    throw new CloudRelayError('network', '网络连接失败，未能撤销')
  }
  if (res.ok) return
  if (res.status === 403) throw new CloudRelayError('forbidden', '撤销凭证已失效，无法撤销')
  if (res.status === 404) throw new CloudRelayError('expired', '链接已过期或被删除')
  throw new CloudRelayError('server', `撤销失败（HTTP ${res.status}）`)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 取回并解密短链接中的简历 */
export async function fetchShortLink(
  id: string,
  key: string,
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<RelayPayload> {
  if (!cloudSupported()) throw new CloudRelayError('unsupported', '当前环境不支持解密（需 https 访问）')
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetchImpl(apiUrl(pageUrl, id), { cache: 'no-store' })
    } catch {
      throw new CloudRelayError('network', '无法取回分享内容，请检查网络')
    }
    if (res.ok) return openResume(await res.text(), key)
    if (res.status !== 404) throw new CloudRelayError('server', `中转服务不可用（HTTP ${res.status}）`)
    if (attempt >= NOT_FOUND_RETRY_MS.length) throw new CloudRelayError('expired', '链接已过期或不存在')
    await wait(NOT_FOUND_RETRY_MS[attempt])
  }
}
