import { normalizeResume, sameResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { decideMerge, type RemoteRow, type Snapshot } from './merge'

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'error'

export interface CloudRemote {
  fetch(): Promise<{ data: unknown; updatedAt: string } | null>
  /** 返回服务器写入后的 updated_at */
  push(data: Resume): Promise<string>
}

export interface SnapshotStore {
  get(): Snapshot | null
  set(s: Snapshot): void
}

export interface SyncState { status: SyncStatus; syncedAt: number | null; message: string }

export interface SyncDeps {
  remote: CloudRemote
  snapshots: SnapshotStore
  getLocal(): Resume
  applyRemote(r: Resume): void
  resolveConflict(local: Resume, remote: RemoteRow): Promise<'local' | 'remote'>
  backup(r: Resume): void
  onChange(s: SyncState): void
  isOnline?(): boolean
  delayMs?: number
}

const MSG_OFFLINE = '离线，恢复网络后自动续传'
const MSG_FAILED = '同步失败，稍后自动重试'
const MSG_INVALID = '云端数据格式异常，已停止同步，本机数据不受影响'

/**
 * 单个登录会话的同步过程：start 先与云端合并一次，之后本机每次保存经 schedule 防抖上传。
 * 本机存储始终是主数据源，云端只是副本；任何失败都不影响本机编辑。
 */
export class CloudSync {
  private state: SyncState = { status: 'syncing', syncedAt: null, message: '' }
  private merged = false
  private halted = false
  private stopped = false
  /** 本机内容即使等于快照也要上传（云端行缺失、冲突选本机） */
  private force = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private starting: Promise<void> | null = null
  private inflight: Promise<void> | null = null
  private again = false

  constructor(private readonly deps: SyncDeps) {}

  start(): Promise<void> {
    this.starting ??= this.merge().finally(() => (this.starting = null))
    return this.starting
  }

  schedule(): void {
    if (!this.merged || this.halted || this.stopped) return
    this.clearTimer()
    this.timer = setTimeout(() => void this.flush(), this.deps.delayMs ?? 2000)
  }

  async flush(): Promise<void> {
    this.clearTimer()
    if (!this.merged || this.halted || this.stopped) return
    if (this.inflight) {
      this.again = true
      return this.inflight
    }
    this.inflight = this.pushOnce()
    try {
      await this.inflight
    } finally {
      this.inflight = null
    }
    if (this.again) {
      this.again = false
      await this.flush()
    }
  }

  /** 离线或失败后的续传入口（网络恢复、定时重试） */
  retry(): void {
    if (this.halted || this.stopped) return
    if (this.state.status !== 'offline' && this.state.status !== 'error') return
    void (this.merged ? this.flush() : this.start())
  }

  stop(): void {
    this.stopped = true
    this.clearTimer()
  }

  private async merge(): Promise<void> {
    if (this.stopped || this.halted) return
    this.emit({ status: 'syncing', message: '' })
    let row: { data: unknown; updatedAt: string } | null
    try {
      row = await this.deps.remote.fetch()
    } catch (e) {
      this.fail(e)
      return
    }
    if (this.stopped) return
    let remote: RemoteRow | null = null
    if (row) {
      try {
        remote = { data: normalizeResume(row.data), updatedAt: row.updatedAt }
      } catch {
        this.halted = true
        this.emit({ status: 'error', message: MSG_INVALID })
        return
      }
    }
    const local = this.deps.getLocal()
    const action = decideMerge(local, this.deps.snapshots.get(), remote)
    if (action === 'push') {
      this.force = true
    } else if (remote && (action === 'align' || action === 'pull')) {
      this.adopt(remote, action === 'pull')
    } else if (remote) {
      const choice = await this.deps.resolveConflict(local, remote)
      if (this.stopped) return
      if (choice === 'remote') {
        this.deps.backup(local)
        this.adopt(remote, true)
      } else {
        this.deps.backup(remote.data)
        this.force = true
      }
    }
    this.merged = true
    await this.flush()
  }

  /** 以云端为准：先记快照再写本机，写本机触发的 schedule 会因内容等于快照而跳过上传 */
  private adopt(remote: RemoteRow, apply: boolean): void {
    this.deps.snapshots.set({ data: remote.data, at: remote.updatedAt })
    if (apply) this.deps.applyRemote(remote.data)
    this.state.syncedAt = Date.now()
  }

  private async pushOnce(): Promise<void> {
    const local = this.deps.getLocal()
    const snap = this.deps.snapshots.get()
    if (!this.force && snap && sameResume(local, snap.data)) {
      this.emit({ status: 'synced', message: '' })
      return
    }
    if (this.deps.isOnline && !this.deps.isOnline()) {
      this.emit({ status: 'offline', message: MSG_OFFLINE })
      return
    }
    this.emit({ status: 'syncing', message: '' })
    try {
      const at = await this.deps.remote.push(local)
      if (this.stopped) return
      this.force = false
      this.deps.snapshots.set({ data: local, at })
      this.state.syncedAt = Date.now()
      this.emit({ status: 'synced', message: '' })
    } catch (e) {
      this.fail(e)
    }
  }

  private fail(e: unknown): void {
    if (this.stopped) return
    const offline = e instanceof TypeError || (this.deps.isOnline ? !this.deps.isOnline() : false)
    this.emit(offline ? { status: 'offline', message: MSG_OFFLINE } : { status: 'error', message: MSG_FAILED })
  }

  private emit(s: { status: SyncStatus; message: string }): void {
    if (this.stopped) return
    this.state = { ...this.state, ...s }
    this.deps.onChange({ ...this.state })
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }
}
