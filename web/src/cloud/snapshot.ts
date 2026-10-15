import type { Resume } from '../model/resume'
import { storage } from '../store/storage'
import type { Snapshot } from './merge'
import type { SnapshotStore } from './sync'

const KEY = 'showme.cloud.snapshot'

interface Stored { userId: string; data: Resume; at: string }

export function createSnapshotStore(userId: string): SnapshotStore {
  return {
    get(): Snapshot | null {
      const raw = storage.get(KEY)
      if (!raw) return null
      try {
        const obj = JSON.parse(raw) as Stored
        if (obj.userId !== userId) return null
        return { data: obj.data, at: obj.at }
      } catch { return null }
    },
    set(s: Snapshot): void {
      storage.set(KEY, JSON.stringify({ userId, data: s.data, at: s.at }))
    },
  }
}
