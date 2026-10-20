import { describe, expect, it, vi } from 'vitest'
import { sampleResume } from '../model/resume'
import { TEMPLATE_IDS } from './catalog'
import { fetchTemplate, renderPayload } from './loader'

/**
 * 模板经 vite 虚拟模块在构建期打包（virtual:showme-templates），与页面 JS 原子更新。
 * 回归背景：旧版导出时裸 fetch /templates/*.html，Service Worker 先行自更新后，
 * 未刷新的旧页面会拿到「新模板 + 旧导出代码」，产出条目末字折行叠印的坏 PDF。
 */
describe('fetchTemplate（虚拟模块）', () => {
  it('三套模板均可取到，运行时已内联、无遗留占位标记', async () => {
    for (const id of TEMPLATE_IDS) {
      const html = await fetchTemplate(id)
      expect(html).toContain('<style>')
      expect(html).toContain('<script>')
      expect(html).toContain('SM.esc') // 运行时确实内联
      expect(html).not.toContain('<!--showme:runtime-->') // 占位标记已替换
      expect(html).toContain('</html>')
    }
  })

  it('不发起任何运行时 fetch（原子性回归测试）', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      await fetchTemplate('air')
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('renderPayload：照片公开地址', () => {
  const path = '3f0e8f7a-1111-4c2b-9d3e-1234567890ab/a1b2c3d4.jpg'

  it('由部署环境推导公开 URL，简历 JSON 里仍只保留路径', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co/')
    try {
      const resume = sampleResume()
      resume.basics.photo = path
      const payload = renderPayload(resume)
      expect(payload.photoURL).toBe(
        `https://demo.supabase.co/storage/v1/object/public/resume-photos/${path}`,
      )
      expect(payload.basics.photo).toBe(path)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('没有照片时不产生 photoURL', () => {
    expect(renderPayload(sampleResume()).photoURL).toBeUndefined()
  })
})
