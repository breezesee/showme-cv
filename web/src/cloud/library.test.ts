import { describe, expect, it } from 'vitest'
import { normalizeResume, ResumeFormatError } from '../model/normalize'
import type { Resume } from '../model/resume'
import { emptyResume, sampleResume } from '../model/resume'
import {
  DuplicateResumeNameError,
  EmptyResumeNameError,
  ResumeLibrary,
  toLibraryError,
  type LibraryBackend,
  type ResumeMeta,
} from './library'

const meta = (id: string, name = id): ResumeMeta => ({ id, name, updatedAt: '2026-10-19T00:00:00.000Z' })

function backend(overrides: Partial<LibraryBackend> = {}): LibraryBackend {
  return {
    list: async () => [],
    get: async () => null,
    insert: async (name) => meta('new-id', name),
    update: async (id, patch) => meta(id, patch.name),
    remove: async () => {},
    ...overrides,
  }
}

describe('ResumeLibrary', () => {
  it('create 清洗名称并把规范化后的数据交给后端', async () => {
    let got: { name: string; data: Resume } | null = null
    const lib = new ResumeLibrary(
      backend({
        insert: async (name, data) => {
          got = { name, data }
          return meta('id-1', name)
        },
      }),
    )
    const input = sampleResume()
    const out = await lib.create('  李小明-产品经理  ', input)
    expect(out).toEqual(meta('id-1', '李小明-产品经理'))
    expect(got!.name).toBe('李小明-产品经理')
    expect(got!.data).toEqual(normalizeResume(input))
  })

  it('名称为空 → EmptyResumeNameError，且不写库', async () => {
    let called = false
    const lib = new ResumeLibrary(
      backend({
        insert: async () => {
          called = true
          return meta('x')
        },
      }),
    )
    await expect(lib.create('   ', emptyResume())).rejects.toBeInstanceOf(EmptyResumeNameError)
    expect(called).toBe(false)
  })

  it('数据库唯一约束（23505）→ DuplicateResumeNameError', async () => {
    const lib = new ResumeLibrary(
      backend({
        insert: async () => {
          throw Object.assign(new Error('duplicate key'), { code: '23505' })
        },
      }),
    )
    await expect(lib.create('同名', sampleResume())).rejects.toBeInstanceOf(DuplicateResumeNameError)
  })

  it('get 打开简历并规范化返回数据', async () => {
    const lib = new ResumeLibrary(
      backend({
        get: async (id) => ({ meta: meta(id, '旧版数据'), data: { basics: { name: '李小明' } } }),
      }),
    )
    const doc = await lib.get('id-9')
    expect(doc.meta.name).toBe('旧版数据')
    expect(doc.data.basics.name).toBe('李小明')
    expect(doc.data.work).toEqual([])
  })

  it('get 找不到 → 明确错误', async () => {
    const lib = new ResumeLibrary(backend())
    await expect(lib.get('missing')).rejects.toThrow('不存在或已被删除')
  })

  it('get 非法数据 → ResumeFormatError', async () => {
    const lib = new ResumeLibrary(
      backend({ get: async (id) => ({ meta: meta(id), data: { basics: 'bad' } }) }),
    )
    await expect(lib.get('bad')).rejects.toBeInstanceOf(ResumeFormatError)
  })

  it('save 按 id 提交名称与规范化数据', async () => {
    let got: { id: string; name: string; data: Resume } | null = null
    const lib = new ResumeLibrary(
      backend({
        update: async (id, patch) => {
          got = { id, name: patch.name, data: patch.data }
          return meta(id, patch.name)
        },
      }),
    )
    const input = sampleResume()
    const out = await lib.save('id-3', '新名称', input)
    expect(out.name).toBe('新名称')
    expect(got!.id).toBe('id-3')
    expect(got!.data).toEqual(normalizeResume(input))
  })

  it('list 返回简历库元数据', async () => {
    const rows = [meta('a', '第一份'), meta('b', '第二份')]
    const lib = new ResumeLibrary(backend({ list: async () => rows }))
    await expect(lib.list()).resolves.toEqual(rows)
  })

  it('remove 调用后端删除', async () => {
    let removed = ''
    const lib = new ResumeLibrary(
      backend({
        remove: async (id) => {
          removed = id
        },
      }),
    )
    await lib.remove('id-7')
    expect(removed).toBe('id-7')
  })
})

describe('toLibraryError', () => {
  it('唯一约束映射为可展示的中文错误', () => {
    const e = toLibraryError(Object.assign(new Error('dup'), { code: '23505' }))
    expect(e).toBeInstanceOf(DuplicateResumeNameError)
    expect(e.message).toContain('同名')
  })

  it('其他错误保持原样；非 Error 兜底为 Error', () => {
    const original = new Error('network down')
    expect(toLibraryError(original)).toBe(original)
    expect(toLibraryError('oops')).toBeInstanceOf(Error)
  })
})
