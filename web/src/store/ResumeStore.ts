import { normalizeResume } from '../model/normalize'
import { sampleResume, type Resume } from '../model/resume'
import { storage } from './storage'

export type LoadStatus = 'ok' | 'empty' | 'corrupt'

export interface LoadResult {
  resume: Resume
  status: LoadStatus
}

/**
 * 简历存储接口。编辑器与预览只通过它读写简历；
 * 后续接入云同步（方案 B）时新增一种实现即可，界面层不改。
 */
export interface ResumeStore {
  load(): LoadResult
  save(resume: Resume): boolean
}

const RESUME_KEY = 'showme.resume.v1'
const CORRUPT_KEY = 'showme.resume.corrupt'

/** 第一版实现：浏览器 localStorage 单键存储 */
export class LocalResumeStore implements ResumeStore {
  load(): LoadResult {
    const raw = storage.get(RESUME_KEY)
    if (raw == null) return { resume: sampleResume(), status: 'empty' }
    try {
      return { resume: normalizeResume(JSON.parse(raw)), status: 'ok' }
    } catch {
      // 原文另存一份，避免被后续自动保存覆盖后彻底丢失
      storage.set(CORRUPT_KEY, raw)
      return { resume: sampleResume(), status: 'corrupt' }
    }
  }

  save(resume: Resume): boolean {
    return storage.set(RESUME_KEY, JSON.stringify(resume))
  }
}
