import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { memoryKV, routeRelay, type RelayEnv } from './server/relay'
import { TEMPLATE_IDS } from './src/templates/catalog'

/**
 * 模板目录：三套简历模板 + 共享运行时（runtime.js / runtime.css）。
 * 模板中的 <!--showme:runtime--> 标记在开发与构建时都替换为内联的运行时，
 * 保证模板是自包含的单文件（srcdoc 与 document.write 都无须再拉取其他资源）。
 */
const TEMPLATE_DIR = fileURLToPath(new URL('./templates', import.meta.url))
const RUNTIME_MARK = '<!--showme:runtime-->'

/** 版本号取自 package.json；构建时间取 vite 配置加载时刻（同一构建内保持一致） */
const PKG = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as { version: string }
const BUILD_TIME = Date.now()

/** 生成 dist/version.json：线上「检查更新」用 no-store 拉取并与注入到页面的构建时间比对 */
function versionManifest(): Plugin {
  return {
    name: 'showme-version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: PKG.version, buildTime: BUILD_TIME }),
      })
    },
  }
}

function readTemplate(id: string): string {
  const read = (name: string) => readFileSync(join(TEMPLATE_DIR, name), 'utf8')
  const runtime = `<style>\n${read('runtime.css')}</style>\n<script>\n${read('runtime.js')}</script>`
  const html = read(`${id}.html`)
  if (!html.includes(RUNTIME_MARK)) throw new Error(`模板 ${id}.html 缺少 ${RUNTIME_MARK} 标记`)
  return html.replace(RUNTIME_MARK, () => runtime)
}

/** 开发时把 /templates/<id>.html 映射到模板目录（内联运行时）；构建时输出到 dist/templates/。
 * 应用运行时已不再拉取该端点（模板改走下方虚拟模块），保留它便于浏览器直接打开模板调试 */
function sharedTemplates(): Plugin {
  return {
    name: 'showme-templates',
    configureServer(server) {
      server.watcher.add(TEMPLATE_DIR)
      server.watcher.on('change', (file) => {
        if (file.startsWith(TEMPLATE_DIR)) server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use((req, res, next) => {
        const m = /^\/templates\/([a-z0-9_-]+)\.html(?:\?.*)?$/.exec(req.url ?? '')
        if (!m || !(TEMPLATE_IDS as readonly string[]).includes(m[1])) return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readTemplate(m[1]))
      })
    },
    generateBundle() {
      for (const id of TEMPLATE_IDS) {
        this.emitFile({ type: 'asset', fileName: `templates/${id}.html`, source: readTemplate(id) })
      }
    },
  }
}

/**
 * 虚拟模块 virtual:showme-templates：把内联运行时后的三套模板以字符串打进一个异步 chunk。
 * 导出/打印/预览改从该模块取模板——模板与页面 JS 同哈希、被 SW 原子预缓存，
 * 从结构上杜绝「未刷新的旧页面 JS + 新模板」的混合状态（曾致旧窗口导出 PDF 末字折行叠印复发）。
 */
function templateModule(): Plugin {
  const ID = 'virtual:showme-templates'
  const RESOLVED = '\0' + ID
  return {
    name: 'showme-template-module',
    resolveId(id) {
      if (id === ID) return RESOLVED
    },
    load(id) {
      if (id !== RESOLVED) return
      const entries = TEMPLATE_IDS.map((tid) => `  ${JSON.stringify(tid)}: ${JSON.stringify(readTemplate(tid))}`)
      return `export const TEMPLATES = {\n${entries.join(',\n')}\n}`
    },
  }
}

/**
 * 管理台不注册主站 Service Worker、也不挂 PWA manifest。
 * VitePWA 的注入发生在 HTML 产物写到磁盘阶段，transformIndexHtml 拦不住，
 * 因此在写盘结束后直接清理 admin.html。
 */
function adminNoPwa(): Plugin {
  let root = process.cwd()
  let outDir = 'dist'
  return {
    name: 'showme-admin-no-pwa',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = config.build.outDir
    },
    closeBundle() {
      const file = resolve(root, outDir, 'admin.html')
      if (!existsSync(file)) return
      const html = readFileSync(file, 'utf8')
      const cleaned = html
        .replace(/\s*<script[^>]*registerSW\.js[^>]*>\s*<\/script>/g, '')
        .replace(/\s*<link[^>]*rel="manifest"[^>]*>/g, '')
      if (cleaned !== html) writeFileSync(file, cleaned)
    },
  }
}

/**
 * 开发 / 预览服务器上模拟短码中转接口（内存 KV，重启即清空），与线上 Netlify Functions 走同一套处理逻辑。
 * 这样不装 netlify-cli 也能在本机、局域网里完整走通「生成二维码 → 扫码导入」。
 */
function relayDev(): Plugin {
  const env: RelayEnv = { RELAY: memoryKV() }
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/relay')) return next()
    void handleNode(req, res, env).catch(next)
  }
  return {
    name: 'showme-relay-dev',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

async function handleNode(req: IncomingMessage, res: ServerResponse, env: RelayEnv): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const method = req.method ?? 'GET'
  const request = new Request(new URL(req.url ?? '/', 'http://localhost'), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
  })
  const response = (await routeRelay(request, env)) ?? new Response('not found', { status: 404 })
  res.statusCode = response.status
  response.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(Buffer.from(await response.arrayBuffer()))
}

export default defineConfig({
  // 相对路径：产物可部署在任意子路径（如 GitHub Pages 的 /仓库名/）
  base: './',
  // 版本自检：页面内的 __APP_VERSION__ / __BUILD_TIME__ 与 dist/version.json 同源同值
  define: {
    __APP_VERSION__: JSON.stringify(PKG.version),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    vue(),
    sharedTemplates(),
    templateModule(),
    relayDev(),
    versionManifest(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      // public/ 下的图标已由 globPatterns 覆盖，不再重复加入预缓存清单
      includeManifestIcons: false,
      manifest: {
        name: 'ShowMe 简历',
        short_name: 'ShowMe',
        description: '手机、电脑都能编辑的简历工具，支持云端简历库与本地保存',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f5f7',
        theme_color: '#f5f5f7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // manifest.webmanifest 由插件自动加入，这里不再匹配；
        // templates/*.html 已打包进 JS（虚拟模块），用 globIgnores 排除出预缓存以免无人引用的冗余副本
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // 管理台是独立入口，不进入主站 PWA 预缓存
        globIgnores: ['templates/*.html', 'admin.html', 'assets/admin-*'],
        navigateFallback: 'index.html',
        // 中转接口与管理台都不能被 Service Worker 拦成首页
        navigateFallbackDenylist: [/^\/api\//, /^\/admin(?:\.html)?(?:\/|$)/],
      },
    }),
    adminNoPwa(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        print: fileURLToPath(new URL('./print.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
