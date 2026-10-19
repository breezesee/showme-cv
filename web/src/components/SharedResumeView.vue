<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RelayPayload } from '../relay/link'
import { useResume } from '../store/useResume'
import type { TemplateId } from '../templates/catalog'
import type { ThemeId } from '../templates/themes'
import { exportPdf } from '../ui/actions'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'
import TemplatePreview from './TemplatePreview.vue'

/** 「仅查看」分享页：锁定发送方排版，不提供编辑、导入或模板/主题切换 */
const props = defineProps<{ incoming: RelayPayload }>()
const emit = defineEmits<{ close: []; 'create-own': [] }>()

const { templateId, themeId } = useResume()
const name = computed(() => props.incoming.resume.basics.name.trim() || '未命名')
const fixedTemplateId = computed<TemplateId>(() => props.incoming.look?.templateId ?? templateId.value)
const fixedThemeId = computed<ThemeId>(() => props.incoming.look?.themeId ?? themeId.value)

const exporting = ref(false)
async function exportView(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  try {
    await exportPdf(props.incoming.resume, fixedTemplateId.value, fixedThemeId.value)
  } catch (e) {
    showToast(`导出 PDF 失败：${e instanceof Error ? e.message : '未知错误'}`, 'error', 5000)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="shared">
    <header class="sv-bar glass">
      <button class="btn btn-plain" type="button" @click="emit('close')"><Icon name="close" />关闭</button>
      <div class="sv-title">
        <strong>{{ name }}</strong>
        <span>仅查看 · 不可编辑</span>
      </div>
      <button class="btn btn-primary" type="button" :disabled="exporting" @click="exportView">
        <Icon name="download" />{{ exporting ? '导出中…' : '导出 PDF' }}
      </button>
    </header>

    <main class="sv-body">
      <div class="sv-note">
        <p class="hint">这是对方分享的只读简历，不能修改内容或切换排版。</p>
        <button class="btn" type="button" @click="emit('create-own')">
          <Icon name="plus" />新建我的简历
        </button>
      </div>
      <TemplatePreview
        :resume="incoming.resume"
        :template-id="fixedTemplateId"
        :theme-id="fixedThemeId"
      />
    </main>
  </div>
</template>

<style scoped>
.shared { min-height: 100vh; min-height: 100dvh; }
.sv-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(8px + var(--safe-top)) calc(8px + var(--safe-right)) 8px calc(8px + var(--safe-left));
  border-bottom: 1px solid var(--line);
}
.sv-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.25;
}
.sv-title strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
}
.sv-title span { color: var(--muted); font-size: 12px; }
.sv-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 16px calc(16px + var(--safe-right)) calc(32px + var(--safe-bottom)) calc(16px + var(--safe-left));
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sv-note { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sv-note .hint { margin: 0; }
</style>
