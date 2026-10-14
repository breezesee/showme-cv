<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, ref } from 'vue'
import { cloudSupported, CloudRelayError, createShortLink } from '../relay/cloud'
import { buildRelayUrl } from '../relay/link'
import { useResume } from '../store/useResume'
import { plainResume } from '../templates/loader'
import { exportCurrent, importFromFile } from '../ui/actions'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'

/** 分享页：短链接二维码 + 离线长链接 + 备份。手机标签页与电脑弹层共用 */
const { resume } = useResume()

const pageUrl = () => location.origin + location.pathname
const isLocalhost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname)
const canShare = typeof navigator.share === 'function'
const canEncrypt = cloudSupported()

const current = computed(() => plainResume(resume.value))
const currentJson = computed(() => JSON.stringify(current.value))
const longUrl = computed(() => buildRelayUrl(pageUrl(), current.value))

// ---------- 短链接 ----------
interface Generated {
  url: string
  qr: string
  expiresAt: number
  /** 生成时的简历快照，用于判断之后是否改过 */
  snapshot: string
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
  try {
    const link = await createShortLink(current.value, pageUrl())
    const qr = await QRCode.toDataURL(link.url, { errorCorrectionLevel: 'M', margin: 2, width: 480 })
    generated.value = { url: link.url, qr, expiresAt: link.expiresAt, snapshot }
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
</script>

<template>
  <div class="share">
    <p v-if="isLocalhost" class="notice">
      当前为本机地址，其他设备无法打开此链接。请用电脑的局域网 IP 或正式网址访问 ShowMe 后再分享。
    </p>

    <section class="card block">
      <h3 class="block-title">二维码</h3>
      <p class="hint">
        简历在本机加密后暂存到服务器，换成一个很短的链接和二维码，7 天内有效。服务器只保存密文，解密密钥只在链接里。
      </p>

      <template v-if="generated">
        <div class="qr" :class="{ faded: stale }">
          <img :src="generated.qr" alt="短链接二维码" width="240" height="240" />
        </div>
        <p v-if="stale" class="notice">内容已修改，请重新生成。</p>
        <div class="link-box"><p class="link" aria-label="短链接">{{ generated.url }}</p></div>
        <p class="hint">有效期至 {{ expiresText }}。链接即凭证，只发给信任的人。</p>
        <div class="actions">
          <button class="btn" type="button" @click="copyLink(generated.url)"><Icon name="copy" />复制链接</button>
          <button v-if="canShare" class="btn" type="button" @click="shareLink(generated.url)"><Icon name="send" />发送到…</button>
          <button class="btn" :class="{ 'btn-primary': stale }" type="button" :disabled="busy" @click="generate">
            <Icon name="qr" />{{ busy ? '生成中…' : '重新生成' }}
          </button>
        </div>
      </template>
      <div v-else class="actions">
        <button class="btn btn-primary" type="button" :disabled="busy || !canEncrypt" @click="generate">
          <Icon name="qr" />{{ busy ? '生成中…' : '生成二维码' }}
        </button>
      </div>

      <p v-if="!canEncrypt" class="notice">
        当前访问地址不是 https，浏览器无法加密，不能生成二维码。请通过 https 网址访问，或改用下方的离线长链接。
      </p>
      <p v-else-if="failure" class="notice">生成失败，可改用下方的离线长链接。（{{ failure }}）</p>

      <ul class="hint directions">
        <li><b>电脑 → 手机</b>：用手机相机扫描电脑屏幕上的二维码。</li>
        <li><b>手机 → 电脑</b>：复制链接或「发送到」微信、QQ 等聊天工具，在电脑上打开。</li>
      </ul>
    </section>

    <section class="card block">
      <h3 class="block-title">离线长链接</h3>
      <p class="hint">整份简历直接编码在链接里，不经过服务器、永不过期；链接很长，只适合复制或发送，不能做成二维码。</p>
      <!-- 不用输入框：iOS 聚焦小字号输入框会自动放大页面 -->
      <div class="link-box"><p class="link" aria-label="离线长链接">{{ longUrl }}</p></div>
      <div class="actions">
        <button class="btn" type="button" @click="copyLink(longUrl)"><Icon name="copy" />复制链接</button>
        <button v-if="canShare" class="btn" type="button" @click="shareLink(longUrl)"><Icon name="send" />发送到…</button>
      </div>
    </section>

    <section class="card block">
      <h3 class="block-title">备份</h3>
      <p class="hint">
        简历只保存在当前浏览器中，清除浏览器数据或更换浏览器后将无法找回，建议定期导出备份。链接是一份快照，之后的修改需要重新分享。
      </p>
      <div class="actions">
        <button class="btn" type="button" @click="exportCurrent"><Icon name="download" />导出 JSON</button>
        <button class="btn" type="button" @click="importFromFile"><Icon name="upload" />导入 JSON</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.share { display: flex; flex-direction: column; gap: 16px; }
.share > .notice { margin: 0; }
.block { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.block-title { margin: 0; font-size: 17px; font-weight: 600; }
.block .hint { margin: 0; }
.link-box {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.link {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
  user-select: all;
  -webkit-user-select: all;
}
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.notice {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(255, 149, 0, 0.12);
  color: #a05a00;
  font-size: 13px;
  line-height: 1.6;
}
.qr { display: flex; justify-content: center; transition: opacity 0.2s; }
.qr.faded { opacity: 0.35; }
.qr img {
  width: min(240px, 100%);
  height: auto;
  image-rendering: pixelated;
  border-radius: 12px;
  border: 1px solid var(--line);
}
.directions { margin: 0; padding-left: 18px; }
.directions b { color: var(--ink); font-weight: 600; }
</style>
