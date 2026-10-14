import { describe, expect, it } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { emptyResume, emptyWork, sampleResume, type Resume } from '../model/resume'
import { buildRelayUrl, buildShortUrl, encodeRelayHash, parseRelayHash } from './link'

const encodeRelayHashFull = (r: Resume) => '#r=1.' + compressToEncodedURIComponent(JSON.stringify(r))

describe('接力链接编解码', () => {
  it('往返一致', () => {
    const r = sampleResume()
    r.basics.name = '张三 <b>&$\'"</b> 🚀'
    r.work[0].highlights.push('', '末行')
    const parsed = parseRelayHash(encodeRelayHash(r))
    expect(parsed).toEqual({ kind: 'ok', resume: r })
  })

  it('空字段不写入链接，解码后补回默认值', () => {
    const r = emptyResume()
    r.basics.name = '张三'
    r.work.push({ ...emptyWork(), company: 'A' })
    const hash = encodeRelayHash(r)
    expect(hash.length).toBeLessThan(encodeRelayHashFull(r).length)
    expect(parseRelayHash(hash)).toEqual({ kind: 'ok', resume: r })
  })

  it('链接只在 hash 中携带数据，且替换掉已有 hash', () => {
    const url = buildRelayUrl('https://a.com/showme/#old', sampleResume())
    expect(url.startsWith('https://a.com/showme/#r=1.')).toBe(true)
    expect(new URL(url).pathname).toBe('/showme/')
    expect(new URL(url).search).toBe('')
  })

  it('非接力 hash 返回 none', () => {
    expect(parseRelayHash('')).toEqual({ kind: 'none' })
    expect(parseRelayHash('#top')).toEqual({ kind: 'none' })
  })

  it('截断、篡改、未知版本均判为损坏', () => {
    const hash = encodeRelayHash(sampleResume())
    expect(parseRelayHash(hash.slice(0, hash.length - 40)).kind).toBe('broken')
    expect(parseRelayHash('#r=1.not-valid-data')).toEqual({ kind: 'broken' })
    expect(parseRelayHash(hash.replace('#r=1.', '#r=9.'))).toEqual({ kind: 'broken' })
    expect(parseRelayHash('#r=')).toEqual({ kind: 'broken' })
  })

  it('解码后的数据同样经过格式校验', () => {
    // 合法压缩、但内容不是简历结构
    const hash = encodeRelayHash({ basics: { name: 1 } } as never)
    expect(parseRelayHash(hash)).toEqual({ kind: 'broken' })
  })

  it('短链接解析出短码与密钥', () => {
    const key = 'AbCdEfGhIjKlMnOpQr_-12'
    const url = buildShortUrl('https://showme-cv.netlify.app/#old', 'a1B2c3D4e5', key)
    expect(url).toBe(`https://showme-cv.netlify.app/#s=1.a1B2c3D4e5.${key}`)
    // 示例域名下短链接不到 70 个字符，二维码版本很低，容易扫
    expect(url.length).toBeLessThan(120)
    expect(parseRelayHash(new URL(url).hash)).toEqual({ kind: 'cloud', id: 'a1B2c3D4e5', key })
  })

  it('格式不对的短链接判为损坏', () => {
    const key = 'AbCdEfGhIjKlMnOpQr_-12'
    expect(parseRelayHash('#s=')).toEqual({ kind: 'broken' })
    expect(parseRelayHash(`#s=2.a1B2c3D4e5.${key}`)).toEqual({ kind: 'broken' })
    expect(parseRelayHash(`#s=1.a1B2c3D4.${key}`)).toEqual({ kind: 'broken' })
    expect(parseRelayHash('#s=1.a1B2c3D4e5.short')).toEqual({ kind: 'broken' })
    expect(parseRelayHash(`#s=1.a1B2c3D4e5.${key}.x`)).toEqual({ kind: 'broken' })
  })
})
