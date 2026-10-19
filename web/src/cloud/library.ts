import { normalizeResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { cleanResumeName } from '../store/resumeName'

type SupabaseClient = import('@supabase/supabase-js').SupabaseClient

/** 简历库条目元数据（列表不拉取 data，减少流量） */
export interface ResumeMeta {
  id: string
  name: string
  /** 服务器写入时间（ISO） */
  updatedAt: string
}

export interface StoredResume {
  meta: ResumeMeta
  data: Resume
}

/** 后端只需实现最基础的增删改查；重名映射与数据校验在 ResumeLibrary 内统一处理 */
export interface LibraryBackend {
  list(): Promise<ResumeMeta[]>
  get(id: string): Promise<{ meta: ResumeMeta; data: unknown } | null>
  insert(name: string, data: Resume): Promise<ResumeMeta>
  update(id: string, patch: { name: string; data: Resume }): Promise<ResumeMeta>
  remove(id: string): Promise<void>
}

export class DuplicateResumeNameError extends Error {
  constructor() {
    super('简历库中已有同名简历')
    this.name = 'DuplicateResumeNameError'
  }
}

export class EmptyResumeNameError extends Error {
  constructor() {
    super('请输入简历名称')
    this.name = 'EmptyResumeNameError'
  }
}

/** 把数据库/网络错误收敛成界面可展示的错误类型 */
export function toLibraryError(e: unknown): Error {
  if ((e as { code?: string } | null)?.code === '23505') return new DuplicateResumeNameError()
  if (e instanceof Error) return e
  return new Error('操作失败，请稍后重试')
}

function plainResume(data: Resume): Resume {
  // 同时剥掉 Vue 响应式代理与未知字段，保证写入的是纯 JSON
  return JSON.parse(JSON.stringify(normalizeResume(data))) as Resume
}

function requireName(raw: string): string {
  const name = cleanResumeName(raw)
  if (!name) throw new EmptyResumeNameError()
  return name
}

/**
 * 云简历库的业务入口：所有方法都做数据校验与错误翻译。
 * 后端可以是 Supabase，也可以是测试内存实现。
 */
export class ResumeLibrary {
  constructor(private readonly backend: LibraryBackend) {}

  async list(): Promise<ResumeMeta[]> {
    try {
      return await this.backend.list()
    } catch (e) {
      throw toLibraryError(e)
    }
  }

  async get(id: string): Promise<StoredResume> {
    let row: { meta: ResumeMeta; data: unknown } | null
    try {
      row = await this.backend.get(id)
    } catch (e) {
      throw toLibraryError(e)
    }
    if (!row) throw new Error('这份简历不存在或已被删除')
    return { meta: row.meta, data: normalizeResume(row.data) }
  }

  async create(rawName: string, data: Resume): Promise<ResumeMeta> {
    const name = requireName(rawName)
    try {
      return await this.backend.insert(name, plainResume(data))
    } catch (e) {
      throw toLibraryError(e)
    }
  }

  async save(id: string, rawName: string, data: Resume): Promise<ResumeMeta> {
    const name = requireName(rawName)
    try {
      return await this.backend.update(id, { name, data: plainResume(data) })
    } catch (e) {
      throw toLibraryError(e)
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.backend.remove(id)
    } catch (e) {
      throw toLibraryError(e)
    }
  }
}

interface ResumeRow {
  id: string
  name: string
  data?: unknown
  updated_at: string
}

const ROW_COLUMNS = 'id, name, data, updated_at'
const LIST_COLUMNS = 'id, name, updated_at'

function toMeta(row: ResumeRow): ResumeMeta {
  return { id: row.id, name: row.name, updatedAt: row.updated_at }
}

/** Supabase 适配层：user_id 过滤与 RLS 双重限定，只访问当前账号的数据 */
export function createSupabaseLibrary(client: SupabaseClient, userId: string): LibraryBackend {
  return {
    async list() {
      const { data, error } = await client
        .from('resumes')
        .select(LIST_COLUMNS)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as ResumeRow[]).map(toMeta)
    },

    async get(id) {
      const { data, error } = await client
        .from('resumes')
        .select(ROW_COLUMNS)
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { meta: toMeta(data as ResumeRow), data: (data as ResumeRow).data }
    },

    async insert(name, data) {
      const { data: row, error } = await client
        .from('resumes')
        .insert({ user_id: userId, name, data: plainResume(data) })
        .select(ROW_COLUMNS)
        .single()
      if (error) throw error
      return toMeta(row as ResumeRow)
    },

    async update(id, patch) {
      const { data: row, error } = await client
        .from('resumes')
        .update({ name: cleanResumeName(patch.name), data: plainResume(patch.data) })
        .eq('id', id)
        .eq('user_id', userId)
        .select(ROW_COLUMNS)
        .single()
      if (error) throw error
      return toMeta(row as ResumeRow)
    },

    async remove(id) {
      const { error } = await client
        .from('resumes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
  }
}
