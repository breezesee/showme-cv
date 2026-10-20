import { describe, expect, it, vi } from 'vitest'
import { photoDataUrl, stripFrozenDimensions, type StyleNode } from './pdf'

/** 构造最小结构树：pdf.ts 的 stripFrozenDimensions 只依赖 style/children/namespaceURI */
function node(opts: { ns?: string; style?: Record<string, string>; children?: StyleNode[] }): StyleNode {
  const style = new Map(Object.entries(opts.style ?? {}))
  return {
    namespaceURI: opts.ns ?? 'http://www.w3.org/1999/xhtml',
    children: opts.children ?? [],
    style: {
      getPropertyValue: (name: string) => style.get(name) ?? '',
      removeProperty: (name: string) => {
        style.delete(name)
      },
      // 测试辅助：读取剩余属性名
      keys: () => [...style.keys()],
    } as unknown as StyleNode['style'],
  }
}

function keysOf(n: StyleNode): string[] {
  return (n.style as unknown as { keys(): string[] }).keys()
}

describe('stripFrozenDimensions', () => {
  it('剥掉后代内联的宽高约束，根节点保留', () => {
    const root = node({
      style: { width: '793.7px', height: '1122.5px', 'font-size': '14.5px' },
      children: [
        node({ style: { width: '251.5px', height: '24.3px', 'font-weight': '600' } }),
        node({
          style: { 'min-width': '96px', 'max-height': '10px', color: 'rgb(34, 34, 38)' },
          children: [node({ style: { width: '552px' } })],
        }),
      ],
    })
    expect(stripFrozenDimensions(root)).toBe(5) // A: width,height；B: min-width,max-height；孙: width
    expect(keysOf(root)).toEqual(['width', 'height', 'font-size'])
    expect(keysOf(root.children[0]!)).toEqual(['font-weight'])
    expect(keysOf(root.children[1]!)).toEqual(['color'])
    expect(keysOf(root.children[1]!.children[0]!)).toEqual([])
  })

  it('跳过非 HTML 命名空间的节点（如 SVG）', () => {
    const svg = node({ ns: 'http://www.w3.org/2000/svg', style: { width: '100px' } })
    const root = node({ children: [svg] })
    expect(stripFrozenDimensions(root)).toBe(0)
    expect(keysOf(svg)).toEqual(['width'])
  })

  it('空树与深层嵌套均安全', () => {
    expect(stripFrozenDimensions(node({}))).toBe(0)
    const deep = node({ style: { height: '1px' }, children: [node({ children: [node({ style: { width: '2px' } })] })] })
    expect(stripFrozenDimensions(deep)).toBe(1) // 根节点 height 保留，仅孙节点 width 被剥
  })
})

describe('photoDataUrl', () => {
  it('没有地址或抓取失败时返回空串，PDF 按无照片导出', async () => {
    expect(await photoDataUrl('')).toBe('')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    try {
      expect(await photoDataUrl('https://x.test/p.jpg')).toBe('')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('对象不存在（非 2xx）同样降级', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    try {
      expect(await photoDataUrl('https://x.test/p.jpg')).toBe('')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
