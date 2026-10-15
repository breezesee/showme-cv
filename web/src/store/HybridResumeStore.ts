import type { Resume } from '../model/resume'
import type { LoadResult, ResumeStore } from './ResumeStore'

export class HybridResumeStore implements ResumeStore {
  constructor(
    private readonly local: ResumeStore,
    private readonly onSaved: (r: Resume) => void,
  ) {}

  load(): LoadResult {
    return this.local.load()
  }

  save(resume: Resume): boolean {
    const ok = this.local.save(resume)
    try { this.onSaved(resume) } catch { /* 云端失败不影响本地保存 */ }
    return ok
  }
}
