/**
 * 版本与缓存自检：构建时由 vite define 注入版本号与构建时间，
 * 并生成 dist/version.json。页面据此显示当前版本、检查远端是否更新、
 * 一键清除 PWA 旧缓存。纯逻辑均导出为可单测的函数。
 */

/** 应用版本号（构建时由 package.json 注入） */
export const APP_VERSION: string = __APP_VERSION__

/** 本次构建时间（epoch 毫秒，构建时注入） */
export const BUILD_TIME: number = __BUILD_TIME__

/** 一份构建的标识信息 */
export interface BuildInfo {
  version: string
  buildTime: number
}

/** 检查结论：latest=已是最新；outdated=本地是旧缓存；unknown=无法判断（如网络失败） */
export type UpdateVerdict = 'latest' | 'outdated' | 'unknown'

/** 本页面这次构建的信息 */
export function currentBuild(): BuildInfo {
  return { version: APP_VERSION, buildTime: BUILD_TIME }
}

/** 构建时间 → 本地时间「MM-DD HH:mm」 */
export function formatBuildTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 远端构建信息是否合法（buildTime 必须是有限数值；version 缺省按空串处理） */
function parseBuildInfo(raw: unknown): BuildInfo | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.buildTime !== 'number' || !Number.isFinite(o.buildTime)) return null
  return { version: typeof o.version === 'string' ? o.version : '', buildTime: o.buildTime }
}

/** 比对远端与本地构建：远端更新 → outdated；远端缺失/非法 → unknown */
export function judgeUpdate(remote: BuildInfo | null | undefined, current: BuildInfo): UpdateVerdict {
  if (!remote) return 'unknown'
  if (!Number.isFinite(remote.buildTime)) return 'unknown'
  return remote.buildTime > current.buildTime ? 'outdated' : 'latest'
}

/** 拉取部署目录下的 version.json；带时间戳参数与 no-store，绕过 HTTP 缓存与 SW 预缓存。失败返回 null */
export async function fetchRemoteBuildInfo(baseUrl = import.meta.env.BASE_URL): Promise<BuildInfo | null> {
  try {
    const res = await fetch(`${baseUrl}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return parseBuildInfo(await res.json())
  } catch {
    return null
  }
}

/** 一次完整「检查更新」：远端不可用一律 unknown */
export async function checkUpdate(baseUrl = import.meta.env.BASE_URL): Promise<UpdateVerdict> {
  return judgeUpdate(await fetchRemoteBuildInfo(baseUrl), currentBuild())
}

/** 清除全部 Cache Storage、注销全部 Service Worker，然后整页刷新（无论清理是否报错） */
export async function clearCachesAndReload(): Promise<void> {
  try {
    try {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {
      // 清理失败不阻断刷新：刷新本身就能摆脱旧缓存
    }
  } finally {
    location.reload()
  }
}
