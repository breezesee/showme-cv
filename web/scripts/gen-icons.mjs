// 生成 PWA 图标（纯 Node，无第三方依赖）：npm run icons
// 输出到 public/icons/：icon.svg、icon-192.png、icon-512.png（圆角）、maskable-512.png、apple-touch-icon.png（满版）
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url))

// 品牌标：奶油纸底 + 钴蓝取景角 + 金色句点（512 网格）
const BG_FROM = [0xfa, 0xf7, 0xef]
const BG_TO = [0xed, 0xe3, 0xd2]
const BLUE = [0x20, 0x49, 0xd8]
const GOLD = [0xc4, 0x92, 0x3f]
const CORNER = 0.225 // 圆角版底板圆角半径
const STROKE_HALF = 26 // 取景角线宽 52 的一半
// 两段取景角：两段直线 + 一个 60 半径的外圆角
const BRACKETS = [
  { segs: [[150, 240, 150, 210], [210, 150, 240, 150]], arc: [210, 210, 60, 180, 270] },
  { segs: [[362, 272, 362, 302], [302, 362, 272, 362]], arc: [302, 302, 60, 0, 90] },
]
const DOT = { cx: 256, cy: 256, r: 34 }

function inRRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r))
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r))
  return dx * dx + dy * dy <= r * r
}

function inCapsule(x, y, ax, ay, bx, by, r) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0
  const px = ax + t * dx
  const py = ay + t * dy
  return (x - px) ** 2 + (y - py) ** 2 <= r * r
}

function inArc(x, y, cx, cy, r, half, a0, a1) {
  if (Math.abs(Math.hypot(x - cx, y - cy) - r) > half) return false
  let angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI
  if (angle < 0) angle += 360
  return angle >= a0 && angle <= a1
}

/** 单个采样点的颜色 [r,g,b,a]，a 为 0/1 */
function sample(x, y, rounded) {
  if (rounded && !inRRect(x, y, 0, 0, 1, 1, CORNER)) return [0, 0, 0, 0]
  const px = x * 512
  const py = y * 512
  if ((px - DOT.cx) ** 2 + (py - DOT.cy) ** 2 <= DOT.r ** 2) return [...GOLD, 1]
  for (const { segs, arc } of BRACKETS) {
    for (const [ax, ay, bx, by] of segs) {
      if (inCapsule(px, py, ax, ay, bx, by, STROKE_HALF)) return [...BLUE, 1]
    }
    const [cx, cy, r, a0, a1] = arc
    if (inArc(px, py, cx, cy, r, STROKE_HALF, a0, a1)) return [...BLUE, 1]
  }
  const t = Math.min(1, Math.max(0, (x + y) / 2))
  return [...BG_FROM.map((v, i) => v + (BG_TO[i] - v) * t), 1]
}

function rasterize(size, rounded, ss = 4) {
  const px = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((pxi + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, rounded)
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3]
        }
      }
      const o = (py * size + pxi) * 4
      px[o] = a ? Math.round(r / a) : 0
      px[o + 1] = a ? Math.round(g / a) : 0
      px[o + 2] = a ? Math.round(b / a) : 0
      px[o + 3] = Math.round((a / (ss * ss)) * 255)
    }
  }
  return px
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // 每行过滤类型：None
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function svg() {
  const rgb = (c) => `rgb(${c.join(',')})`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${rgb(BG_FROM)}"/><stop offset="1" stop-color="${rgb(BG_TO)}"/></linearGradient></defs>
<rect width="512" height="512" rx="${(CORNER * 512).toFixed(1)}" fill="url(#g)"/>
<path d="M150 240 L150 210 A60 60 0 0 1 210 150 L240 150" fill="none" stroke="${rgb(BLUE)}" stroke-width="52" stroke-linecap="round"/>
<path d="M362 272 L362 302 A60 60 0 0 1 302 362 L272 362" fill="none" stroke="${rgb(BLUE)}" stroke-width="52" stroke-linecap="round"/>
<circle cx="256" cy="256" r="34" fill="${rgb(GOLD)}"/>
</svg>
`
}

mkdirSync(OUT, { recursive: true })
const outputs = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
]
for (const [name, size, rounded] of outputs) {
  writeFileSync(OUT + name, encodePng(size, rasterize(size, rounded)))
  console.log('✓', name)
}
writeFileSync(OUT + 'icon.svg', svg())
console.log('✓ icon.svg')
