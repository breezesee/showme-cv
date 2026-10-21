/**
 * Netlify Functions（v2）：短码中转接口。
 * - config.path 同时挂载 POST /api/relay（存密文）与 GET /api/relay/<id>（取密文），
 *   方法校验与业务逻辑全部复用 server/relay.ts 的 routeRelay。
 * - 存储用 Netlify Blobs 适配 RelayKV：Blobs 没有原生 TTL，
 *   把过期时间写进值里，读取时判断（懒过期），到期后读出来即为 null。
 * - 服务端只保存浏览器端加密后的密文（base64url 文本），不接触密钥，也无法解读内容。
 */
import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { RELAY_TTL_SECONDS, routeRelay, type RelayKV } from '../../server/relay'

/** Blobs 里的单条记录：v 为密文原文，exp 为过期毫秒时间戳 */
interface RelayRecord {
  v: string
  exp: number
}

const blobsKV: RelayKV = {
  async get(key) {
    const record = (await getStore('relay').get(key, { type: 'json' })) as RelayRecord | null
    if (record === null || record.exp <= Date.now()) return null
    return record.v
  },
  async put(key, value, options) {
    const ttl = options?.expirationTtl ?? RELAY_TTL_SECONDS
    const record: RelayRecord = { v: value, exp: Date.now() + ttl * 1000 }
    await getStore('relay').set(key, JSON.stringify(record))
  },
  async delete(key) {
    await getStore('relay').delete(key)
  },
}

export default async (req: Request): Promise<Response> => {
  const response = await routeRelay(req, { RELAY: blobsKV })
  return response ?? new Response('Not Found', { status: 404 })
}

export const config: Config = {
  path: ['/api/relay', '/api/relay/*'],
}
