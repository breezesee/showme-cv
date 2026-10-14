// 生成 PWA 图标（纯 Node，无第三方依赖）：npm run icons
// 输出到 public/icons/：icon.svg、icon-192.png、icon-512.png（圆角）、maskable-512.png、apple-touch-icon.png（满版）
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url))

// 图形定义（单位坐标 0..1）：蓝色渐变底 + 白色简历卡片
const GRAD_FROM = [0x5a, 0xc8, 0xfa]
const GRAD_TO = [0x0a, 0x84, 0xff]
const CORNER = 0.225 // 圆角版底板圆角半径
const CARD = { x0: 0.3, y0: 0.24, x1: 0.7, y1: 0.76, r: 0.05 }
const SHAPES = [
  { kind: 'circle', cx: 0.395, cy: 0.355, r: 0.05, color: '#0a84ff' },
  { kind: 'rect', x0: 0.475, y0: 0.322, x1: 0.63, y1: 0.35, color: '#3a3a3c' },
  { kind: 'rect', x0: 0.475, y0: 0.368, x1: 0.58, y1: 0.39, color: '#c7c7cc' },
  { kind: 'rect', x0: 0.345, y0: 0.46, x1: 0.47, y1: 0.484, color: '#0a84ff' },
  { kind: 'rect', x0: 0.345, y0: 0.52, x1: 0.655, y1: 0.542, color: '#d1d1d6' },
  { kind: 'rect', x0: 0.345, y0: 0.572, x1: 0.655, y1: 0.594, color: '#d1d1d6' },
  { kind: 'rect', x0: 0.345, y0: 0.624, x1: 0.56, y1: 0.646, color: '#d1d1d6' },
  { kind: 'rect', x0: 0.345, y0: 0.676, x1: 0.61, y1: 0.698, color: '#d1d1d6' },
]

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))

function inRRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r))
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r))
  return dx * dx + dy * dy <= r * r
}

function inShape(s, x, y) {
  if (s.kind === 'circle') return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r
  return inRRect(x, y, s.x0, s.y0, s.x1, s.y1, (s.y1 - s.y0) / 2)
}

/** 单个采样点的颜色 [r,g,b,a]，a 为 0/1 */
function sample(x, y, rounded) {
  if (rounded && !inRRect(x, y, 0, 0, 1, 1, CORNER)) return [0, 0, 0, 0]
  for (let i = SHAPES.length - 1; i >= 0; i--) {
    if (inShape(SHAPES[i], x, y)) return [...hex(SHAPES[i].color), 1]
  }
  if (inRRect(x, y, CARD.x0, CARD.y0, CARD.x1, CARD.y1, CARD.r)) return [255, 255, 255, 1]
  const t = Math.min(1, Math.max(0, (x + y) / 2))
  return [...GRAD_FROM.map((v, i) => v + (GRAD_TO[i] - v) * t), 1]
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
  const n = (v) => +(v * 512).toFixed(1)
  const shapes = SHAPES.map((s) =>
    s.kind === 'circle'
      ? `<circle cx="${n(s.cx)}" cy="${n(s.cy)}" r="${n(s.r)}" fill="${s.color}"/>`
      : `<rect x="${n(s.x0)}" y="${n(s.y0)}" width="${n(s.x1 - s.x0)}" height="${n(s.y1 - s.y0)}" rx="${n((s.y1 - s.y0) / 2)}" fill="${s.color}"/>`,
  ).join('')
  const rgb = (c) => `rgb(${c.join(',')})`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${rgb(GRAD_FROM)}"/><stop offset="1" stop-color="${rgb(GRAD_TO)}"/></linearGradient></defs>
<rect width="512" height="512" rx="${n(CORNER)}" fill="url(#g)"/>
<rect x="${n(CARD.x0)}" y="${n(CARD.y0)}" width="${n(CARD.x1 - CARD.x0)}" height="${n(CARD.y1 - CARD.y0)}" rx="${n(CARD.r)}" fill="#fff"/>
${shapes}
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
