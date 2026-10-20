<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, nextTick, ref } from 'vue'
import { cloudSupported, CloudRelayError, createShortLink } from '../relay/cloud'
import { buildRelayUrl, type RelayLook, type SharePermission } from '../relay/link'
import { useResume } from '../store/useResume'
import { plainResume } from '../templates/loader'
import { exportCurrent, exportPdf, exportWord, importFromFile, printResume } from '../ui/actions'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'

/** 分享页：分享（二维码 / 链接）、导出（PDF / Word / 备份）、导入。手机标签页与电脑弹层共用 */
const { resume, templateId, themeId } = useResume()

const pageUrl = () => location.origin + location.pathname
const isLocalhost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname)
const canShare = typeof navigator.share === 'function'
const canEncrypt = cloudSupported()

// ---------- 对方打开后的权限 ----------
const PERMISSIONS: { id: SharePermission; label: string }[] = [
  { id: 'edit', label: '允许编辑' },
  { id: 'view', label: '仅查看' },
]
const permission = ref<SharePermission>('edit')
const permGroup = ref<HTMLElement>()

function onPermKeydown(e: KeyboardEvent): void {
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const i = PERMISSIONS.findIndex((p) => p.id === permission.value)
  const next = (i + dir + PERMISSIONS.length) % PERMISSIONS.length
  permission.value = PERMISSIONS[next]!.id
  void nextTick(() => (permGroup.value?.children[next] as HTMLElement | undefined)?.focus())
}

const current = computed(() => plainResume(resume.value))
/** 发送时的外观也随简历接力，接收方看到的就是你这边的排版与配色 */
const look = computed<RelayLook>(() => ({ templateId: templateId.value, themeId: themeId.value }))
const currentJson = computed(() => JSON.stringify([current.value, look.value, permission.value]))
const longUrl = computed(() => buildRelayUrl(pageUrl(), current.value, look.value, permission.value))

// ---------- 分享：短链接与二维码 ----------
interface Generated {
  url: string
  qr: string
  expiresAt: number
  /** 生成时的简历快照，用于判断之后是否改过 */
  snapshot: string
  permission: SharePermission
}
const generated = ref<Generated | null>(null)
const busy = ref(false)
const failure = ref('')
const stale = computed(() => !!generated.value && generated.value.snapshot !== currentJson.value)
const expiresText = computed(() => {
  if (!generated.value) return ''
  const d = new Date(generated.value.expiresAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

async function generate(): Promise<void> {
  if (busy.value) return
  busy.value = true
  failure.value = ''
  const snapshot = currentJson.value
  const mode = permission.value
  try {
    const link = await createShortLink(current.value, pageUrl(), look.value, mode)
    const qr = await QRCode.toDataURL(link.url, { errorCorrectionLevel: 'M', margin: 2, width: 480 })
    generated.value = { url: link.url, qr, expiresAt: link.expiresAt, snapshot, permission: mode }
  } catch (e) {
    generated.value = null
    failure.value = e instanceof CloudRelayError ? e.message : '未知错误'
  } finally {
    busy.value = false
  }
}

// ---------- 复制与系统分享 ----------
async function copyLink(url: string): Promise<void> {
  if (await writeClipboard(url)) showToast('已复制', 'success')
  else showToast('复制失败，请长按链接手动复制', 'error')
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 非安全上下文（如局域网 http 地址）没有 Clipboard API，退回旧接口
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

async function shareLink(url: string): Promise<void> {
  const name = resume.value.basics.name.trim()
  try {
    await navigator.share({ title: name ? `${name}的简历` : 'ShowMe 简历', url })
  } catch (e) {
    if ((e as DOMException)?.name !== 'AbortError') showToast('系统分享不可用，请改用复制链接', 'error')
  }
}

// ---------- 导出：PDF / Word / JSON 备份 ----------
type ExportKind = 'pdf' | 'word'
const exporting = ref<ExportKind | ''>('')
const EXPORT_LABEL: Record<ExportKind, string> = { pdf: 'PDF', word: 'Word 文档' }

async function runExport(kind: ExportKind): Promise<void> {
  if (exporting.value) return
  exporting.value = kind
  try {
    if (kind === 'pdf') await exportPdf(resume.value, templateId.value, themeId.value)
    else await exportWord(current.value)
  } catch (e) {
    showToast(`导出${EXPORT_LABEL[kind]}失败：${e instanceof Error ? e.message : '未知错误'}`, 'error', 5000)
  } finally {
    exporting.value = ''
  }
}
</script>

<template>
  <div class="share">
    <p v-if="isLocalhost" class="notice">
      当前为本机地址，其他设备无法打开此链接。请用电脑的局域网 IP 或正式网址访问 ShowMe 后再分享。
    </p>

    <p class="hint share-note">分享与导出的都是当前编辑中的内容，包含尚未保存的修改。</p>

    <!-- 分享：二维码是主角 -->
    <section class="card block">
      <header class="zone-head">
        <h3>分享</h3>
        <p class="hint">简历在本机加密后换成短链接和二维码，7 天有效。服务器只保存密文，解密钥匙只在链接里。</p>
      </header>

      <div class="perm-row">
        <div ref="permGroup" class="perm" role="radiogroup" aria-label="对方打开后的权限" @keydown="onPermKeydown">
          <button
            v-for="opt in PERMISSIONS"
            :key="opt.id"
            class="perm-item"
            :class="{ active: permission === opt.id }"
            type="button"
            role="radio"
            :aria-checked="permission === opt.id"
            :tabindex="permission === opt.id ? 0 : -1"
            @click="permission = opt.id"
          >
            {{ opt.label }}
          </button>
        </div>
        <p class="hint perm-hint">
          {{ permission === 'view' ? '对方只能查看与导出 PDF，不能导入或修改排版。' : '对方可导入一份自己的副本继续编辑，不会改动你的原件。' }}
        </p>
      </div>

      <p v-if="!canEncrypt" class="notice">
        当前访问地址不是 https，浏览器无法加密，不能生成二维码。请通过 https 网址访问，或改用下方的离线长链接。
      </p>

      <div v-else class="share-main">
        <div class="stage">
          <img
            v-if="generated"
            class="qr"
            :class="{ faded: stale }"
            :src="generated.qr"
            alt="短链接二维码"
            width="168"
            height="168"
          />
          <div v-else class="qr-blank" aria-hidden="true"><Icon name="qr" /></div>
        </div>

        <div class="share-side">
          <template v-if="generated">
            <!-- 不用输入框：iOS 聚焦小字号输入框会自动放大页面 -->
            <div class="capsule">
              <span class="link" aria-label="短链接" :title="generated.url">{{ generated.url }}</span>
              <button class="icon-btn" type="button" aria-label="复制短链接" @click="copyLink(generated.url)">
                <Icon name="copy" />
              </button>
            </div>
            <p class="badges">
              <span v-if="stale" class="badge warn">内容或权限已修改</span>
              <span class="badge">{{ generated.permission === 'view' ? '仅查看' : '可编辑' }}</span>
              <span class="badge">{{ stale ? '重新生成后生效' : `7 天内有效 · 至 ${expiresText}` }}</span>
            </p>
            <div class="actions">
              <button v-if="canShare" class="btn" type="button" @click="shareLink(generated.url)">
                <Icon name="send" />发送到…
              </button>
              <button class="btn" :class="{ 'btn-primary': stale }" type="button" :disabled="busy" @click="generate">
                <Icon name="qr" />{{ busy ? '生成中…' : '重新生成' }}
              </button>
            </div>
          </template>
          <template v-else>
            <p class="hint">
              扫码或打开链接即可{{ permission === 'view' ? '查看' : '导入' }}这份简历，电脑手机互传都行。
            </p>
            <div class="actions">
              <button class="btn btn-primary" type="button" :disabled="busy" @click="generate">
                <Icon name="qr" />{{ busy ? '生成中…' : '生成二维码' }}
              </button>
            </div>
          </template>
          <p v-if="failure" class="notice">生成失败，可改用下方离线链接。（{{ failure }}）</p>
        </div>
      </div>

      <ul class="hint directions">
        <li><b>电脑 → 手机</b>：手机相机扫电脑屏幕上的码。</li>
        <li><b>手机 → 电脑</b>：复制链接或发到微信、QQ，在电脑打开。</li>
      </ul>

      <details class="more">
        <summary>更多方式：离线长链接</summary>
        <p class="hint">整份简历直接编码在链接里，不经过服务器、永不过期；链接很长，适合复制或发送，做不了二维码。</p>
        <div class="capsule">
          <span class="link" aria-label="离线长链接" :title="longUrl">{{ longUrl }}</span>
          <button class="icon-btn" type="button" aria-label="复制离线长链接" @click="copyLink(longUrl)">
            <Icon name="copy" />
          </button>
        </div>
        <div v-if="canShare" class="actions">
          <button class="btn" type="button" @click="shareLink(longUrl)"><Icon name="send" />发送到…</button>
        </div>
      </details>
    </section>

    <!-- 导出：文件到本机 -->
    <section class="card block">
      <header class="zone-head">
        <h3>导出</h3>
        <p class="hint">把简历保存为文件：投递、存档，或换台设备继续用。</p>
      </header>
      <div class="exports">
        <button class="export-row" type="button" :disabled="!!exporting" @click="runExport('pdf')">
          <span class="export-text">
            <b>PDF</b>
            <small>与预览完全一致，适合直接发送</small>
          </span>
          <span v-if="exporting === 'pdf'" class="spinner" role="status" aria-label="正在导出 PDF" />
          <span v-else class="ext">.pdf</span>
        </button>
        <button class="export-row" type="button" :disabled="!!exporting" @click="runExport('word')">
          <span class="export-text">
            <b>Word</b>
            <small>可编辑，适合继续修改后投递</small>
          </span>
          <span v-if="exporting === 'word'" class="spinner" role="status" aria-label="正在导出 Word" />
          <span v-else class="ext">.docx</span>
        </button>
        <button class="export-row" type="button" @click="exportCurrent">
          <span class="export-text">
            <b>JSON 备份</b>
            <small>数据文件，可在其他设备导入</small>
          </span>
          <span class="ext">.json</span>
        </button>
      </div>
      <p class="hint print-alt">
        需要可选中文字的 PDF？<button class="link-btn" type="button" @click="printResume(resume, templateId, themeId)">用打印版</button>
      </p>
    </section>

    <!-- 备份与恢复：从 JSON 备份导入 -->
    <section class="card block">
      <header class="zone-head">
        <h3>备份与恢复</h3>
        <p class="hint">从 JSON 备份恢复简历。导入后会成为一份未保存的草稿，确认内容后点击「保存」。</p>
      </header>
      <div class="actions">
        <button class="btn" type="button" @click="importFromFile"><Icon name="upload" />导入备份</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.share { display: flex; flex-direction: column; gap: 16px; }
.share > .notice { margin: 0; }
.share-note { margin: 0; }
.block { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.zone-head { display: flex; flex-direction: column; gap: 2px; }
.zone-head h3 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }
.zone-head .hint { margin: 0; }

/* 权限分段控件：与模板选择器同一套 iOS 风外观 */
.perm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.perm { display: inline-flex; padding: 2px; border-radius: 11px; background: var(--fill); }
.perm-item {
  min-width: 76px;
  min-height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ink);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s var(--ease), box-shadow 0.2s var(--ease), color 0.2s var(--ease);
}
@media (hover: hover) {
  .perm-item:not(.active):hover { color: var(--muted); }
}
.perm-item.active {
  background: #fff;
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.08);
}
.perm-hint { margin: 0; }
@media (max-width: 1099.98px) {
  .perm { display: flex; flex: 1; }
  .perm-item { flex: 1; min-height: 40px; }
  .perm-hint { flex-basis: 100%; }
}

/* 二维码舞台：生成前后占同一块位置，面板不跳动 */
.share-main { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 20px; }
.stage { flex: none; }
.qr-blank, .qr {
  width: 168px;
  height: 168px;
  border-radius: 12px;
}
.qr-blank {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--line);
  color: var(--disabled);
  background: var(--bg);
}
.qr-blank svg { width: 34px; height: 34px; }
.qr {
  image-rendering: pixelated;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);
  transition: opacity 0.2s var(--ease);
}
.qr.faded { opacity: 0.35; }
.share-side {
  flex: 1 1 220px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.share-side .hint { margin: 0; }

/* 链接胶囊：单行 + 复制按钮 */
.capsule {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 0 4px 0 12px;
  height: 40px;
  border-radius: 10px;
  background: var(--fill);
}
.link {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  user-select: all;
  -webkit-user-select: all;
}
.icon-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  transition: background-color 0.2s var(--ease);
}
.icon-btn:hover { background: var(--fill-strong); }
.icon-btn svg { width: 16px; height: 16px; }

/* 状态徽标 */
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--fill);
  color: var(--muted);
  font-size: 12px;
}
.badge.warn { background: var(--warning-bg); color: var(--warning); }

.actions { display: flex; flex-wrap: wrap; gap: 10px; }

.directions { margin: 0; padding-left: 18px; }
.directions b { color: var(--ink); font-weight: 600; }

/* 离线长链接：折叠的次级方式 */
.more { border-top: 1px solid var(--line); padding-top: 12px; }
.more summary {
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  min-height: 24px;
  display: flex;
  align-items: center;
  width: fit-content;
}
.more[open] summary { margin-bottom: 8px; }

/* 导出行：标题 + 一句话说明 + 扩展名徽标 */
.exports { display: flex; flex-direction: column; gap: 8px; }
.export-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 56px;
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s var(--ease), transform 0.12s var(--ease);
}
.export-row:hover:not(:disabled) { background: var(--fill); }
.export-row:active:not(:disabled) { transform: scale(0.98); }
.export-row:disabled { opacity: 0.45; cursor: default; }
.export-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.export-text b { font-size: 15px; font-weight: 600; }
.export-text small { color: var(--muted); font-size: 12.5px; }
.ext {
  flex: none;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--fill);
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
.spinner {
  flex: none;
  width: 16px;
  height: 16px;
  margin: 4px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.print-alt { margin: 0; }
/* 行内文字按钮：与 hint 同字号，仅颜色区分 */
.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  min-height: 24px;
}
.link-btn:hover { text-decoration: underline; }
</style>
