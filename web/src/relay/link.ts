import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { normalizeResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { isTemplateId, type TemplateId } from '../templates/catalog'
import { isThemeId, type ThemeId } from '../templates/themes'

/**
 * 接力链接的两种形态：
 * - 离线长链接 #r=<编码版本>.<数据>：简历压缩后整份放进 hash，不依赖服务器，但太长，不适合做二维码；
 * - 短链接 #s=<版本>.<短码>.<密钥>：密文存在中转服务（见 ./cloud.ts），链接只带短码与密钥。
 * hash 不随请求发送，托管方看不到长链接中的简历，也拿不到短链接的密钥。
 */
const HASH_PREFIX = '#r='
/** 当前编码版本：数据是 { r, t, h } 信封，携带发送方选择的模板与主题 */
const CODEC_VERSION = '2'
/** 旧版链接只有简历本体，没有外观，仍可解码 */
const LEGACY_CODEC_VERSION = '1'
const SHORT_PREFIX = '#s='
const SHORT_VERSION = '1'
const SHORT_ID_PATTERN = /^[0-9A-Za-z]{10}$/
/** 128 位密钥的 base64url 文本（无填充）为 22 个字符 */
const SHORT_KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/

/** 发送方的外观选择，随简历一起接力；缺失时接收方退回自己的本机偏好 */
export interface RelayLook {
  templateId?: TemplateId
  themeId?: ThemeId
}

export interface RelayPayload {
  resume: Resume
  look?: RelayLook
}

export type RelayParseResult =
  | { kind: 'none' }
  | { kind: 'broken' }
  | ({ kind: 'ok' } & RelayPayload)
  | { kind: 'cloud'; id: string; key: string }

/** 压缩前/解密后的共用编码：把简历与外观打包成 JSON 文本 */
export function encodeRelayData(resume: Resume, look?: RelayLook): string {
  const withLook = look?.templateId || look?.themeId
  const payload = withLook ? { r: resume, t: look?.templateId, h: look?.themeId } : resume
  return JSON.stringify(payload, dropEmpty)
}

/** 解码并校验；不是简历结构时抛错。兼容旧版「只有简历本体」的数据 */
export function decodeRelayData(data: unknown): RelayPayload {
  if (isEnvelope(data)) {
    const look: RelayLook = {}
    if (isTemplateId(data.t)) look.templateId = data.t
    if (isThemeId(data.h)) look.themeId = data.h
    const resume = normalizeResume(data.r)
    return look.templateId || look.themeId ? { resume, look } : { resume }
  }
  return { resume: normalizeResume(data) }
}

function isEnvelope(v: unknown): v is { r: unknown; t?: unknown; h?: unknown } {
  return typeof v === 'object' && v !== null && 'r' in v
}

export function encodeRelayHash(resume: Resume, look?: RelayLook): string {
  return `${HASH_PREFIX}${CODEC_VERSION}.${compressToEncodedURIComponent(encodeRelayData(resume, look))}`
}

/** 省略空字符串与空数组字段以缩短数据；解码时由 normalizeResume 补回默认值。数组内的空行保留 */
export function dropEmpty(this: unknown, key: string, value: unknown): unknown {
  if (key === '' || Array.isArray(this)) return value
  if (value === '' || (Array.isArray(value) && value.length === 0)) return undefined
  return value
}

/** base 为不含 hash 的页面地址，如 https://example.com/showme/ */
export function buildRelayUrl(base: string, resume: Resume, look?: RelayLook): string {
  return base.replace(/#.*$/, '') + encodeRelayHash(resume, look)
}

export function buildShortUrl(base: string, id: string, key: string): string {
  return `${base.replace(/#.*$/, '')}${SHORT_PREFIX}${SHORT_VERSION}.${id}.${key}`
}

export function parseRelayHash(hash: string): RelayParseResult {
  if (hash.startsWith(SHORT_PREFIX)) return parseShort(hash.slice(SHORT_PREFIX.length))
  if (!hash.startsWith(HASH_PREFIX)) return { kind: 'none' }
  const body = hash.slice(HASH_PREFIX.length)
  const dot = body.indexOf('.')
  const version = dot < 0 ? '' : body.slice(0, dot)
  if (version !== CODEC_VERSION && version !== LEGACY_CODEC_VERSION) return { kind: 'broken' }
  try {
    const json = decompressFromEncodedURIComponent(body.slice(dot + 1))
    if (!json) return { kind: 'broken' }
    return { kind: 'ok', ...decodeRelayData(JSON.parse(json)) }
  } catch {
    return { kind: 'broken' }
  }
}

function parseShort(body: string): RelayParseResult {
  const [version, id, key, ...rest] = body.split('.')
  if (rest.length || version !== SHORT_VERSION || !SHORT_ID_PATTERN.test(id ?? '') || !SHORT_KEY_PATTERN.test(key ?? '')) {
    return { kind: 'broken' }
  }
  return { kind: 'cloud', id, key }
}
