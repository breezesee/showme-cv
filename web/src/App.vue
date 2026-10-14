<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import ReceivedView from './components/ReceivedView.vue'
import ResumeEditor from './components/ResumeEditor.vue'
import SharePanel from './components/SharePanel.vue'
import Sheet from './components/Sheet.vue'
import TemplatePicker from './components/TemplatePicker.vue'
import TemplatePreview from './components/TemplatePreview.vue'
import ThemePicker from './components/ThemePicker.vue'
import ToastHost from './components/ToastHost.vue'
import Icon, { type IconName } from './components/Icon.vue'
import type { Resume } from './model/resume'
import { CloudRelayError, fetchShortLink } from './relay/cloud'
import { parseRelayHash } from './relay/link'
import { useResume } from './store/useResume'
import { exportCurrent, importFromFile, printResume } from './ui/actions'
import { showToast } from './ui/toast'
import { useMediaQuery } from './ui/useMediaQuery'

const { resume, templateId, themeId, initialStatus } = useResume()
const isWide = useMediaQuery('(min-width: 900px)')
const logo = `${import.meta.env.BASE_URL}icons/icon.svg`

type Tab = 'edit' | 'preview' | 'share'
const TABS: { id: Tab; label: string; title: string; icon: IconName }[] = [
  { id: 'edit', label: '编辑', title: '我的简历', icon: 'edit' },
  { id: 'preview', label: '预览', title: '预览', icon: 'eye' },
  { id: 'share', label: '分享', title: '分享与备份', icon: 'share' },
]
const tab = ref<Tab>('edit')
const tabTitle = computed(() => TABS.find((t) => t.id === tab.value)!.title)
const shareOpen = ref(false)

/** 通过接力链接收到、尚未处理的简历 */
const incoming = shallowRef<Resume | null>(null)

/** 处理地址中的接力数据；返回是否存在接力链接 */
function consumeRelayHash(): boolean {
  const result = parseRelayHash(location.hash)
  if (result.kind === 'none') return false
  // 先清掉地址中的数据：刷新不会重复弹出，数据和密钥也不会留在浏览历史里
  history.replaceState(history.state, '', location.pathname + location.search)
  if (result.kind === 'broken') showToast('链接已损坏，未导入任何内容', 'error', 4000)
  else if (result.kind === 'ok') incoming.value = result.resume
  else void receiveShortLink(result.id, result.key)
  return true
}

async function receiveShortLink(id: string, key: string): Promise<void> {
  const dismiss = showToast('正在取回分享的简历…', 'info', 15000)
  try {
    incoming.value = await fetchShortLink(id, key, location.href)
    dismiss()
  } catch (e) {
    dismiss()
    const message = e instanceof CloudRelayError ? e.message : '无法取回分享内容'
    showToast(`${message}，未导入任何内容`, 'error', 5000)
  }
}

function onHashChange(): void {
  consumeRelayHash()
}

function closeIncoming(): void {
  incoming.value = null
  window.scrollTo(0, 0)
}

function selectTab(next: Tab): void {
  tab.value = next
  window.scrollTo(0, 0)
}

onMounted(() => {
  const relayed = consumeRelayHash()
  window.addEventListener('hashchange', onHashChange)
  if (relayed) return
  if (initialStatus === 'corrupt') showToast('本地简历数据无法读取，已另存原文并载入示例简历', 'error', 5000)
  else if (initialStatus === 'empty') showToast('已载入示例简历，修改会自动保存在本浏览器中', 'info', 4000)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <ReceivedView v-if="incoming" :incoming="incoming" @close="closeIncoming" />

  <!-- 宽屏：顶部工具栏 + 编辑 / 预览双栏 -->
  <div v-else-if="isWide" class="wide">
    <header class="toolbar glass">
      <div class="brand"><img :src="logo" alt="" width="28" height="28" />ShowMe</div>
      <TemplatePicker v-model="templateId" />
      <div class="tools">
        <button class="btn btn-plain" type="button" @click="importFromFile"><Icon name="upload" />导入</button>
        <button class="btn btn-plain" type="button" @click="exportCurrent"><Icon name="download" />导出</button>
        <button class="btn" type="button" @click="shareOpen = true"><Icon name="share" />分享</button>
        <button class="btn btn-primary" type="button" @click="printResume(resume, templateId, themeId)"><Icon name="print" />打印 / 导出 PDF</button>
      </div>
    </header>
    <main class="columns">
      <div class="col-edit"><ResumeEditor /></div>
      <div class="col-preview">
        <ThemePicker v-model="themeId" class="col-themes" />
        <TemplatePreview :resume="resume" :template-id="templateId" :theme-id="themeId" />
      </div>
    </main>
    <Sheet v-model:open="shareOpen" title="分享与备份"><SharePanel /></Sheet>
  </div>

  <!-- 窄屏：大标题 + 单页内容 + 底部标签栏 -->
  <div v-else class="narrow">
    <header class="large-title">
      <h1>{{ tabTitle }}</h1>
    </header>
    <main class="narrow-body">
      <ResumeEditor v-show="tab === 'edit'" class="pane" />
      <div v-show="tab === 'preview'" class="preview-page">
        <TemplatePicker v-model="templateId" />
        <ThemePicker v-model="themeId" />
        <TemplatePreview :resume="resume" :template-id="templateId" :theme-id="themeId" />
        <button class="btn btn-primary btn-block" type="button" @click="printResume(resume, templateId, themeId)">
          <Icon name="print" />打印 / 导出 PDF
        </button>
      </div>
      <SharePanel v-if="tab === 'share'" class="pane" />
    </main>
    <nav class="tabbar glass" aria-label="主导航">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="tab"
        :class="{ active: tab === t.id }"
        type="button"
        :aria-current="tab === t.id ? 'page' : undefined"
        @click="selectTab(t.id)"
      >
        <Icon :name="t.icon" />
        <span>{{ t.label }}</span>
      </button>
    </nav>
  </div>

  <ToastHost />
</template>

<style scoped>
/* ---------- 宽屏 ---------- */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 20px;
  height: var(--toolbar-h);
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
}
.brand { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 700; letter-spacing: 0.2px; }
.brand img { border-radius: 7px; }
.tools { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.columns {
  display: grid;
  grid-template-columns: minmax(380px, 460px) minmax(0, 1fr);
  gap: 28px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
  align-items: start;
}
.col-preview {
  position: sticky;
  top: calc(var(--toolbar-h) + 24px);
  max-height: calc(100vh - var(--toolbar-h) - 48px);
  padding: 4px 8px 16px; /* 给纸张阴影留出空间 */
  overflow-y: auto;
  scrollbar-gutter: stable; /* 滚动条出现与否不改变宽度，避免缩放来回跳动 */
  scrollbar-width: thin;
}

/* ---------- 窄屏 ---------- */
.narrow { min-height: 100vh; min-height: 100dvh; }
.large-title {
  padding: calc(20px + var(--safe-top)) calc(20px + var(--safe-right)) 4px calc(20px + var(--safe-left));
}
.large-title h1 { margin: 0; font-size: 34px; font-weight: 800; letter-spacing: 0.3px; line-height: 1.15; }
.narrow-body {
  padding: 12px calc(16px + var(--safe-right)) calc(var(--tabbar-h) + var(--safe-bottom) + 24px) calc(16px + var(--safe-left));
}
.preview-page { display: flex; flex-direction: column; gap: 16px; }
.col-themes { margin: 0 0 14px; }
/* 平板竖屏（600–900px）：编辑 / 分享表单限宽居中，预览保持满宽 */
@media (min-width: 600px) and (max-width: 899.98px) {
  .pane { max-width: 640px; margin-inline: auto; }
}
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  padding: 0 var(--safe-right) var(--safe-bottom) var(--safe-left);
  border-top: 1px solid var(--line);
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: var(--tabbar-h);
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}
.tab svg { width: 24px; height: 24px; }
.tab.active { color: var(--accent); }
</style>
