<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  cloudSupported,
  CloudRelayError,
  createShortLink,
  revokeShortLink,
  SHORT_LINK_TTLS,
  type ShortLinkTtl,
} from '../relay/cloud'
import { buildRelayUrl, type RelayLook, type SharePermission } from '../relay/link'
import {
  addRecentLink,
  loadRecentLinks,
  removeRecentLink,
  type RecentLink,
} from '../relay/recent'
import { useResume } from '../store/useResume'
import { plainResume } from '../templates/loader'
import { exportCurrent, exportPdf, exportWord, importFromFile, printResume } from '../ui/actions'
import { confirmDialog } from '../ui/confirm'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'
import ImportTextForm from './ImportTextForm.vue'
import ResumeCheckPanel from './ResumeCheckPanel.vue'

/** 分享页：分享（二维码 / 链接）、导出（投递版 / 设计版 / Word / 备份）、导入。手机标签页与电脑弹层共用 */
const emit = defineEmits<{ 'edit-target': [target: string] }>()
const { resume, templateId, themeId } = useResume()

const pageUrl = () => location.origin + location.pathname
const isLocalhost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname)
const canShare = typeof navigator.share === 'function'
const canEncrypt = cloudSupported()
const hasLocalPhoto = computed(() => resume.value.basics.photo.startsWith('data:'))

// ---------- 分享意图：决定接收方打开后的权限 ----------
const INTENTS: { id: SharePermission; label: string; hint: string }[] = [
  { id: 'view', label: '发给招聘方 / 朋友', hint: '对方只能查看与导出 PDF，不能修改内容。' },
  { id: 'edit', label: '传到我的另一台设备', hint: '对方可导入一份副本继续编辑，不会改动你的原件。' },
]
const permission = ref<SharePermission>('view')
const ttl = ref<ShortLinkTtl>(7)
const intentGroup = ref<HTMLElement>()
const ttlGroup = ref<HTMLElement>()

function moveChoice<T extends string | number>(
  e: KeyboardEvent,
  group: HTMLElement | undefined,
  options: readonly T[],
  current: T,
  select: (value: T) => void,
): void {
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const index = options.indexOf(current)
  const next = (index + dir + options.length) % options.length
  select(options[next]!)
  void nextTick(() => (group?.children[next] as HTMLElement | undefined)?.focus())
}

function onIntentKeydown(e: KeyboardEvent): void {
  moveChoice(e, intentGroup.value, INTENTS.map((item) => item.id), permission.value, (value) => (permission.value = value))
}

function onTtlKeydown(e: KeyboardEvent): void {
  moveChoice(e, ttlGroup.value, SHORT_LINK_TTLS, ttl.value, (value) => (ttl.value = value))
}

const current = computed(() => plainResume(resume.value))
/** 发送时的外观也随简历接力，接收方看到的就是你这边的排版与配色 */
const look = computed<RelayLook>(() => ({ templateId: templateId.value, themeId: themeId.value }))
const currentJson = computed(() => JSON.stringify([current.value, look.value, permission.value]))
const longUrl = computed(() => buildRelayUrl(pageUrl(), current.value, look.value, permission.value))

// ---------- 分享：短链接与二维码 ----------
interface ShownLink extends RecentLink {
  qr: string
}

const generated = ref<ShownLink | null>(null)
const recent = ref<RecentLink[]>([])
const busy = ref(false)
const revokingId = ref('')
const failure = ref('')
const stale = computed(
  () => !!generated.value && (generated.value.snapshot !== currentJson.value || generated.value.ttlDays !== ttl.value),
)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function expiresLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function showLink(link: RecentLink): Promise<void> {
  try {
    const qr = await QRCode.toDataURL(link.url, { errorCorrectionLevel: 'M', margin: 2, width: 480 })
    generated.value = { ...link, qr }
  } catch {
    generated.value = null
    showToast('二维码生成失败，请复制链接使用', 'error')
  }
}

onMounted(() => {
  recent.value = loadRecentLinks()
  const latest = recent.value[0]
  if (latest) void showLink(latest)
})

async function generate(): Promise<void> {
  if (busy.value) return
  busy.value = true
  failure.value = ''
  const snapshot = currentJson.value
  const mode = permission.value
  const days = ttl.value
  try {
    const link = await createShortLink(current.value, pageUrl(), look.value, mode, { ttlDays: days })
    const record: RecentLink = {
      id: link.id,
      url: link.url,
      expiresAt: link.expiresAt,
      permission: mode,
      ttlDays: days,
      revokeToken: link.revokeToken,
      snapshot,
      createdAt: Date.now(),
    }
    recent.value = addRecentLink(record)
    await showLink(record)
  } catch (e) {
    generated.value = null
    failure.value = e instanceof CloudRelayError ? e.message : '未知错误'
  } finally {
    busy.value = false
  }
}

async function revoke(link: RecentLink): Promise<void> {
  if (revokingId.value) return
  const ok = await confirmDialog({
    title: '让这个链接立即失效？',
    message: '撤销后，任何设备都无法再通过这个链接打开这份简历。已经打开的页面不受影响。',
    confirmText: '立即失效',
    danger: true,
  })
  if (!ok) return
  revokingId.value = link.id
  try {
    await revokeShortLink(link.id, link.revokeToken, pageUrl())
    recent.value = removeRecentLink(link.id)
    if (generated.value?.id === link.id) generated.value = null
    showToast('链接已失效', 'success')
  } catch (e) {
    showToast(e instanceof CloudRelayError ? e.message : '撤销失败', 'error', 5000)
  } finally {
    revokingId.value = ''
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

// ---------- 导出：投递版 PDF / 设计版 PDF / Word / JSON 备份 ----------
type ExportKind = 'print' | 'pdf' | 'word'
const exporting = ref<Exclude<ExportKind, 'print'> | ''>('')
const EXPORT_LABEL: Record<Exclude<ExportKind, 'print'>, string> = { pdf: '设计版 PDF', word: 'Word 文档' }

function exportDeliverable(): void {
  printResume(resume.value, templateId.value, themeId.value)
}

async function runExport(kind: Exclude<ExportKind, 'print'>): Promise<void> {
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

    <!-- 分享：先选用途，再生成链接 -->
    <section class="card block">
      <header class="zone-head">
        <h3>分享</h3>
        <p class="hint">简历在本机加密后换成短链接和二维码，服务器只保存密文，解密钥匙只在链接里。</p>
      </header>

      <div ref="intentGroup" class="intents" role="radiogroup" aria-label="分享用途" @keydown="onIntentKeydown">
        <button
          v-for="opt in INTENTS"
          :key="opt.id"
          class="intent"
          :class="{ active: permission === opt.id }"
          type="button"
          role="radio"
          :aria-checked="permission === opt.id"
          :tabindex="permission === opt.id ? 0 : -1"
          @click="permission = opt.id"
        >
          <span class="intent-label">{{ opt.label }}</span>
          <span class="intent-hint">{{ opt.hint }}</span>
        </button>
      </div>

      <div class="ttl-row">
        <span class="field-label">链接有效期</span>
        <div ref="ttlGroup" class="ttl" role="radiogroup" aria-label="链接有效期" @keydown="onTtlKeydown">
          <button
            v-for="days in SHORT_LINK_TTLS"
            :key="days"
            class="ttl-item"
            :class="{ active: ttl === days }"
            type="button"
            role="radio"
            :aria-checked="ttl === days"
            :tabindex="ttl === days ? 0 : -1"
            @click="ttl = days"
          >
            {{ days }} 天
          </button>
        </div>
        <span class="hint">生成后可随时让它提前失效</span>
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
              <span v-if="stale" class="badge warn">简历或设置已修改</span>
              <span class="badge">{{ generated.permission === 'view' ? '仅查看' : '可编辑' }}</span>
              <span class="badge">
                {{ stale ? '重新生成后生效' : `${generated.ttlDays} 天内有效 · 至 ${expiresLabel(generated.expiresAt)}` }}
              </span>
            </p>
            <div class="actions">
              <button v-if="canShare" class="btn" type="button" @click="shareLink(generated.url)">
                <Icon name="send" />发送到…
              </button>
              <button class="btn" :class="{ 'btn-primary': stale }" type="button" :disabled="busy" @click="generate">
                <Icon name="qr" />{{ busy ? '生成中…' : '重新生成' }}
              </button>
              <button
                class="btn btn-danger"
                type="button"
                :disabled="!!revokingId"
                @click="revoke(generated)"
              >
                <Icon name="trash" />{{ revokingId === generated.id ? '撤销中…' : '立即失效' }}
              </button>
            </div>
          </template>
          <template v-else>
            <p class="hint">
              生成后，扫码或打开链接即可{{ permission === 'view' ? '查看' : '导入编辑' }}这份简历，电脑手机互传都行。
            </p>
            <div class="actions">
              <button class="btn btn-primary" type="button" :disabled="busy" @click="generate">
                <Icon name="qr" />{{ busy ? '生成中…' : '生成链接与二维码' }}
              </button>
            </div>
          </template>
          <p v-if="failure" class="notice">生成失败：{{ failure }}</p>
        </div>
      </div>

      <ul class="hint directions">
        <li><b>电脑 → 手机</b>：手机相机扫电脑屏幕上的码。</li>
        <li><b>手机 → 电脑</b>：复制链接或发到微信、QQ，在电脑打开。</li>
      </ul>

      <div v-if="recent.length" class="recent">
        <h4>最近生成的链接</h4>
        <ul class="recent-list">
          <li
            v-for="item in recent"
            :key="item.id"
            class="recent-row"
            :class="{ current: generated?.id === item.id }"
          >
            <div class="recent-main">
              <span class="recent-url" :title="item.url">{{ item.url }}</span>
              <span class="recent-meta">
                {{ item.permission === 'view' ? '仅查看' : '可编辑' }} · {{ item.ttlDays }} 天 · 至
                {{ expiresLabel(item.expiresAt) }}
              </span>
            </div>
            <div class="recent-actions">
              <button class="icon-btn" type="button" aria-label="显示二维码" @click="showLink(item)">
                <Icon name="qr" />
              </button>
              <button class="icon-btn" type="button" aria-label="复制链接" @click="copyLink(item.url)">
                <Icon name="copy" />
              </button>
              <button
                class="icon-btn danger"
                type="button"
                aria-label="让链接失效"
                :disabled="!!revokingId"
                @click="revoke(item)"
              >
                <Icon name="trash" />
              </button>
            </div>
          </li>
        </ul>
      </div>

      <details v-if="!hasLocalPhoto" class="more">
        <summary>更多方式：离线长链接</summary>
        <p class="hint">整份简历直接编码在链接里，不经过服务器、永不过期；生成后无法撤回。链接很长，适合复制或发送，做不了二维码。</p>
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
      <p v-else class="hint">
        简历含本地照片，离线长链接会过长而无法发送或扫码，请使用上方的短链接。
      </p>
    </section>

    <ResumeCheckPanel @edit-target="emit('edit-target', $event)" />

    <!-- 导出：文件到本机 -->
    <section class="card block">
      <header class="zone-head">
        <h3>导出</h3>
        <p class="hint">投递用第一个；需要视觉版或继续编辑时再选其他格式。</p>
      </header>
      <div class="exports">
        <button class="export-row primary" type="button" @click="exportDeliverable">
          <span class="export-text">
            <b>投递版 PDF <span class="rec">推荐</span></b>
            <small>文字可选中、招聘系统能识别；在打印对话框选择「另存为 PDF」</small>
          </span>
          <span class="ext">.pdf</span>
        </button>
        <button class="export-row" type="button" :disabled="!!exporting" @click="runExport('pdf')">
          <span class="export-text">
            <b>设计版 PDF</b>
            <small>与预览完全一致的视觉版，文字不可选中</small>
          </span>
          <span v-if="exporting === 'pdf'" class="spinner" role="status" aria-label="正在导出设计版 PDF" />
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
    </section>

    <!-- 导入：JSON 备份或已有的简历文字 -->
    <section class="card block">
      <header class="zone-head">
        <h3>导入</h3>
        <p class="hint">从 JSON 备份或已有的简历文字创建一份未保存草稿，确认内容后点击「保存」。</p>
      </header>
      <div class="actions">
        <button class="btn" type="button" @click="importFromFile"><Icon name="upload" />导入备份</button>
      </div>
      <details class="more paste-more">
        <summary>粘贴简历文字导入</summary>
        <ImportTextForm @imported="emit('edit-target', 'sec-basics')" />
      </details>
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

/* 分享用途：两张卡片，默认「仅查看」 */
.intents { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.intent {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 66px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.intent:hover { background: var(--fill); }
.intent.active {
  border-color: var(--accent);
  background: rgba(0, 113, 227, 0.06);
  box-shadow: 0 0 0 1px var(--accent) inset;
}
.intent-label { font-size: 14px; font-weight: 600; }
.intent-hint { color: var(--muted); font-size: 12px; line-height: 1.5; }
@media (max-width: 560px) {
  .intents { grid-template-columns: 1fr; }
}

/* 有效期：小号分段控件 */
.ttl-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.field-label { flex: none; color: var(--muted); font-size: 13px; }
.ttl { display: inline-flex; padding: 2px; border-radius: 10px; background: var(--fill); }
.ttl-item {
  min-width: 64px;
  min-height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.ttl-item.active {
  background: #fff;
  font-weight: 600;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.08);
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
  transition: background-color 0.2s var(--ease), color 0.2s var(--ease);
}
.icon-btn:hover { background: var(--fill-strong); }
.icon-btn:disabled { opacity: 0.35; cursor: default; }
.icon-btn.danger { color: var(--danger); }
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

/* 最近链接：保留 5 条，可再次显示二维码、复制或撤销 */
.recent { border-top: 1px solid var(--line); padding-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.recent h4 { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted); }
.recent-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.recent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 10px;
  border-radius: 10px;
  background: var(--bg);
}
.recent-row.current { box-shadow: 0 0 0 1px var(--accent) inset; }
.recent-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.recent-url {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  user-select: all;
  -webkit-user-select: all;
}
.recent-meta { color: var(--muted); font-size: 11.5px; }
.recent-actions { flex: none; display: flex; align-items: center; gap: 2px; }

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
  transition: background-color 0.2s var(--ease), transform 0.12s var(--ease), border-color 0.2s var(--ease);
}
.export-row:hover:not(:disabled) { background: var(--fill); }
.export-row:active:not(:disabled) { transform: scale(0.98); }
.export-row:disabled { opacity: 0.45; cursor: default; }
.export-row.primary { border-color: rgba(0, 113, 227, 0.45); background: rgba(0, 113, 227, 0.04); }
.export-row.primary:hover { background: rgba(0, 113, 227, 0.08); }
.export-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.export-text b { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; }
.export-text small { color: var(--muted); font-size: 12.5px; }
.rec {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
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
</style>
