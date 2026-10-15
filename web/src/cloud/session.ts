import { reactive } from 'vue'
import { normalizeResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { exportResumeFile } from '../store/backup'
import { confirmDialog } from '../ui/confirm'
import { authErrorMessage } from './authErrors'
import { cloudConfigured, getClient, hasStoredSession } from './client'
import { createRemote } from './remote'
import { createSnapshotStore } from './snapshot'
import { CloudSync, type SyncStatus } from './sync'

export interface CloudState {
  available: boolean
  ready: boolean
  email: string
  status: SyncStatus | ''
  syncedAt: number | null
  message: string
}

export const cloud = reactive<CloudState>({
  available: cloudConfigured(),
  ready: false,
  email: '',
  status: '',
  syncedAt: null,
  message: '',
})

let sync: CloudSync | null = null
let hooks: { getLocal(): Resume; applyRemote(r: Resume): void } | null = null
let retryTimer: ReturnType<typeof setInterval> | null = null

export function initCloud(h: { getLocal(): Resume; applyRemote(r: Resume): void }): void {
  hooks = h
  if (!cloud.available) return
  if (hasStoredSession()) {
    void bootstrap()
  }
}

async function bootstrap(): Promise<void> {
  const client = await getClient()
  const { data: { session } } = await client.auth.getSession()
  if (!session) return
  await attach(session.user.id, session.user.email ?? '')
}

async function attach(userId: string, email: string): Promise<void> {
  if (!hooks) return
  teardown()
  cloud.email = email
  cloud.ready = true
  const h = hooks
  const client = await getClient()
  sync = new CloudSync({
    remote: createRemote(client, userId),
    snapshots: createSnapshotStore(userId),
    getLocal: () => normalizeResume(h.getLocal()),
    applyRemote: h.applyRemote,
    resolveConflict: async (_local, _remote) => {
      const keep = await confirmDialog({
        title: '简历冲突',
        message: `本机与云端的简历内容不同，要用云端的覆盖本机吗？（被覆盖一方会先下载一份 JSON 备份）`,
        confirmText: '用云端',
        cancelText: '用本机',
      })
      return keep ? 'remote' : 'local'
    },
    backup: exportResumeFile,
    onChange: (s) => {
      cloud.status = s.status
      cloud.syncedAt = s.syncedAt
      cloud.message = s.message
    },
  })
  void sync.start()
  retryTimer = setInterval(() => sync?.retry(), 30_000)
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pagehide', onPagehide)
}

function teardown(): void {
  sync?.stop()
  sync = null
  if (retryTimer !== null) clearInterval(retryTimer)
  retryTimer = null
  window.removeEventListener('online', onOnline)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('pagehide', onPagehide)
}

function onOnline() { sync?.retry() }
function onVisible() { if (document.visibilityState === 'visible') sync?.retry() }
function onPagehide() { /* flush is not awaitable on pagehide; best-effort */ }

export function notifySaved(): void {
  sync?.schedule()
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = await getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  await attach(data.user.id, data.user.email ?? email)
}

export async function signUp(email: string, password: string): Promise<void> {
  const client = await getClient()
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  if (!data.session) {
    throw Object.assign(new Error('email_not_confirmed'), { code: 'email_not_confirmed' })
  }
  await attach(data.user!.id, data.user!.email ?? email)
}

export async function signOut(): Promise<void> {
  teardown()
  cloud.email = ''
  cloud.ready = false
  cloud.status = ''
  cloud.syncedAt = null
  cloud.message = ''
  try {
    const client = await getClient()
    await client.auth.signOut()
  } catch { /* ignore */ }
}

export { authErrorMessage }
