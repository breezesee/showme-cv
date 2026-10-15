import { describe, expect, it, vi } from 'vitest'
import { sampleResume, type Resume } from '../model/resume'
import type { LoadResult, ResumeStore } from './ResumeStore'
import { HybridResumeStore } from './HybridResumeStore'

class FakeStore implements ResumeStore {
  saved: Resume | null = null
  load(): LoadResult { return { resume: sampleResume(), status: 'ok' } }
  save(r: Resume): boolean { this.saved = r; return true }
}

describe('HybridResumeStore', () => {
  it('save 先写本地再调 onSaved', () => {
    const local = new FakeStore()
    const onSaved = vi.fn()
    const hybrid = new HybridResumeStore(local, onSaved)
    const r = sampleResume()
    const ok = hybrid.save(r)
    expect(ok).toBe(true)
    expect(local.saved).toBe(r)
    expect(onSaved).toHaveBeenCalledWith(r)
  })

  it('onSaved 抛异常不影响本地保存结果', () => {
    const local = new FakeStore()
    const onSaved = vi.fn(() => { throw new Error('kaboom') })
    const hybrid = new HybridResumeStore(local, onSaved)
    const ok = hybrid.save(sampleResume())
    expect(ok).toBe(true)
    expect(local.saved).not.toBeNull()
  })

  it('load 转发到本地', () => {
    const local = new FakeStore()
    const hybrid = new HybridResumeStore(local, vi.fn())
    expect(hybrid.load().status).toBe('ok')
  })
})
