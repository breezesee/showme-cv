import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyResume, type Resume } from '../model/resume'
import type { Snapshot } from './merge'
import { CloudSync, type SyncDeps, type SyncStatus } from './sync'

function resume(name: string): Resume {
  const r = emptyResume()
  r.basics.name = name
  return r
}

const T1 = '2026-10-15T10:00:00.000Z'
const T2 = '2026-10-15T11:00:00.000Z'

interface Harness {
  sync: CloudSync
  deps: SyncDeps
  local: { value: Resume }
  cloud: { row: { data: unknown; updatedAt: string } | null; fail: unknown }
  snap: { value: Snapshot | null }
  pushes: Resume[]
  states: { status: SyncStatus; message: string }[]
  online: { value: boolean }
}

function setup(init: { local: Resume; remote?: { data: unknown; updatedAt: string } | null; snapshot?: Snapshot | null; choice?: 'local' | 'remote' }): Harness {
  const local = { value: init.local }
  const cloud: Harness['cloud'] = { row: init.remote ?? null, fail: null }
  const snap = { value: init.snapshot ?? null }
  const pushes: Resume[] = []
  const states: Harness['states'] = []
  const online = { value: true }
  let clock = Date.parse(T2)
  const deps: SyncDeps = {
    remote: {
      fetch: vi.fn(async () => cloud.row),
      push: vi.fn(async (data: Resume) => {
        if (cloud.fail) throw cloud.fail
        pushes.push(structuredClone(data))
        clock += 1000
        const at = new Date(clock).toISOString()
        cloud.row = { data: structuredClone(data), updatedAt: at }
        return at
      }),
    },
    snapshots: { get: () => snap.value, set: (s) => void (snap.value = s) },
    getLocal: () => structuredClone(local.value),
    applyRemote: vi.fn((r: Resume) => void (local.value = r)),
    resolveConflict: vi.fn(async () => init.choice ?? 'local'),
    backup: vi.fn(),
    onChange: (s) => void states.push({ status: s.status, message: s.message }),
    isOnline: () => online.value,
    delayMs: 2000,
  }
  return { sync: new CloudSync(deps), deps, local, cloud, snap, pushes, states, online }
}

const last = (h: Harness) => h.states[h.states.length - 1]

describe('CloudSync', () => {
  beforeEach(() => void vi.useFakeTimers())
  afterEach(() => void vi.useRealTimers())

  it('云端无数据：登录即上传，状态为已同步', async () => {
    const h = setup({ local: resume('甲') })
    await h.sync.start()
    expect(h.pushes).toEqual([resume('甲')])
    expect(h.snap.value?.data).toEqual(resume('甲'))
    expect(last(h).status).toBe('synced')
  })

  it('云端数据覆盖空白本机，不回传', async () => {
    const h = setup({ local: emptyResume(), remote: { data: resume('云'), updatedAt: T1 } })
    await h.sync.start()
    expect(h.deps.applyRemote).toHaveBeenCalledWith(resume('云'))
    h.sync.schedule()
    await vi.advanceTimersByTimeAsync(2000)
    expect(h.pushes).toEqual([])
    expect(last(h).status).toBe('synced')
  })

  it('连续编辑防抖合并为一次上传', async () => {
    const h = setup({ local: resume('甲'), remote: { data: resume('甲'), updatedAt: T1 } })
    await h.sync.start()
    h.local.value = resume('甲1')
    h.sync.schedule()
    h.local.value = resume('甲12')
    h.sync.schedule()
    h.local.value = resume('甲123')
    h.sync.schedule()
    await vi.advanceTimersByTimeAsync(1999)
    expect(h.pushes).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(h.pushes).toEqual([resume('甲123')])
  })

  it('内容与上次同步一致时不上传', async () => {
    const h = setup({ local: resume('甲'), remote: { data: resume('甲'), updatedAt: T1 } })
    await h.sync.start()
    h.sync.schedule()
    await vi.advanceTimersByTimeAsync(2000)
    expect(h.pushes).toEqual([])
  })

  it('合并完成前的编辑延后到合并后再上传', async () => {
    const h = setup({ local: resume('甲'), snapshot: { data: resume('甲'), at: T1 } })
    let release!: (v: { data: unknown; updatedAt: string }) => void
    const fetch = h.deps.remote.fetch as ReturnType<typeof vi.fn>
    fetch.mockImplementationOnce(() => new Promise((r) => (release = r)))
    const started = h.sync.start()
    h.local.value = resume('甲改')
    h.sync.schedule()
    await vi.advanceTimersByTimeAsync(2000)
    expect(h.deps.remote.push).not.toHaveBeenCalled()
    release({ data: resume('甲'), updatedAt: T1 })
    await started
    expect(h.deps.resolveConflict).not.toHaveBeenCalled()
    expect(h.pushes).toEqual([resume('甲改')])
  })

  it('断网失败显示离线，重试后续传成功', async () => {
    const h = setup({ local: resume('甲'), remote: { data: resume('甲'), updatedAt: T1 } })
    await h.sync.start()
    h.cloud.fail = new TypeError('Failed to fetch')
    h.local.value = resume('甲改')
    await h.sync.flush()
    expect(last(h)).toEqual({ status: 'offline', message: '离线，恢复网络后自动续传' })
    h.cloud.fail = null
    h.sync.retry()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.pushes).toEqual([resume('甲改')])
    expect(last(h).status).toBe('synced')
  })

  it('浏览器离线时不发请求，直接显示离线', async () => {
    const h = setup({ local: resume('甲'), remote: { data: resume('甲'), updatedAt: T1 } })
    await h.sync.start()
    h.online.value = false
    h.local.value = resume('甲改')
    await h.sync.flush()
    expect(h.deps.remote.push).not.toHaveBeenCalled()
    expect(last(h).status).toBe('offline')
  })

  it('服务端错误显示同步失败', async () => {
    const h = setup({ local: resume('甲'), remote: { data: resume('甲'), updatedAt: T1 } })
    await h.sync.start()
    h.cloud.fail = Object.assign(new Error('boom'), { code: '500' })
    h.local.value = resume('甲改')
    await h.sync.flush()
    expect(last(h)).toEqual({ status: 'error', message: '同步失败，稍后自动重试' })
  })

  it('冲突选云端：本机内容先备份再被覆盖', async () => {
    const h = setup({ local: resume('本机'), remote: { data: resume('云端'), updatedAt: T1 }, choice: 'remote' })
    await h.sync.start()
    expect(h.deps.resolveConflict).toHaveBeenCalled()
    expect(h.deps.backup).toHaveBeenCalledWith(resume('本机'))
    expect(h.local.value).toEqual(resume('云端'))
    expect(h.pushes).toEqual([])
  })

  it('冲突选本机：云端内容先备份再被覆盖', async () => {
    const h = setup({ local: resume('本机'), remote: { data: resume('云端'), updatedAt: T1 }, choice: 'local' })
    await h.sync.start()
    expect(h.deps.backup).toHaveBeenCalledWith(resume('云端'))
    expect(h.pushes).toEqual([resume('本机')])
    expect(h.local.value).toEqual(resume('本机'))
  })

  it('云端行丢失但快照仍在：仍然上传', async () => {
    const h = setup({ local: resume('甲'), remote: null, snapshot: { data: resume('甲'), at: T1 } })
    await h.sync.start()
    expect(h.pushes).toEqual([resume('甲')])
  })

  it('云端数据格式异常：停止同步，不再上传', async () => {
    const h = setup({ local: resume('甲'), remote: { data: { basics: 'bad' }, updatedAt: T1 } })
    await h.sync.start()
    expect(last(h)).toEqual({ status: 'error', message: '云端数据格式异常，已停止同步，本机数据不受影响' })
    h.local.value = resume('甲改')
    h.sync.schedule()
    h.sync.retry()
    await vi.advanceTimersByTimeAsync(2000)
    expect(h.deps.remote.push).not.toHaveBeenCalled()
    expect(h.deps.applyRemote).not.toHaveBeenCalled()
  })

  it('拉取失败后重试会重新合并', async () => {
    const h = setup({ local: resume('甲') })
    const fetch = h.deps.remote.fetch as ReturnType<typeof vi.fn>
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await h.sync.start()
    expect(last(h).status).toBe('offline')
    h.sync.retry()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.pushes).toEqual([resume('甲')])
  })

  it('stop 之后不再上传', async () => {
    const h = setup({ local: resume('甲'), remote: { data: resume('甲'), updatedAt: T1 } })
    await h.sync.start()
    h.local.value = resume('甲改')
    h.sync.schedule()
    h.sync.stop()
    await vi.advanceTimersByTimeAsync(2000)
    await h.sync.flush()
    expect(h.pushes).toEqual([])
  })
})
