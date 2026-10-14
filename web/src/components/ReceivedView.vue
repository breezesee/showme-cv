<script setup lang="ts">
import { computed, ref } from 'vue'
import { sameResume } from '../model/normalize'
import type { Resume } from '../model/resume'
import { useResume } from '../store/useResume'
import { confirmOverwrite, printResume } from '../ui/actions'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'
import TemplatePicker from './TemplatePicker.vue'
import TemplatePreview from './TemplatePreview.vue'
import ThemePicker from './ThemePicker.vue'

/** 「收到的简历」：只读预览接力链接带来的简历，由用户决定导入或仅查看 */
const props = defineProps<{ incoming: Resume }>()
const emit = defineEmits<{ close: [] }>()

const { resume, templateId, themeId, replaceResume } = useResume()
const viewOnly = ref(false)
const name = computed(() => props.incoming.basics.name.trim() || '未命名')

function importIncoming(): void {
  if (sameResume(props.incoming, resume.value)) {
    showToast('与本机简历相同，无需导入')
  } else {
    if (!confirmOverwrite(props.incoming)) return
    replaceResume(props.incoming)
    showToast('已导入为我的简历', 'success')
  }
  emit('close')
}
</script>

<template>
  <div class="received">
    <header class="rv-bar glass">
      <button class="btn btn-plain" type="button" @click="emit('close')"><Icon name="close" />关闭</button>
      <div class="rv-title">
        <strong>收到的简历</strong>
        <span>{{ name }}</span>
      </div>
      <button class="btn btn-plain" type="button" @click="printResume(incoming, templateId, themeId)"><Icon name="print" />打印</button>
    </header>

    <main class="rv-body">
      <section v-if="!viewOnly" class="card rv-prompt">
        <p>这是通过链接收到的「{{ name }}」的简历，尚未保存到本机。</p>
        <button class="btn btn-primary btn-block" type="button" @click="importIncoming">导入为我的简历</button>
        <button class="btn btn-block" type="button" @click="viewOnly = true">仅查看</button>
      </section>
      <div v-else class="rv-inline">
        <span class="hint">仅查看，关闭后本机简历保持不变</span>
        <button class="btn" type="button" @click="importIncoming">导入为我的简历</button>
      </div>

      <div class="rv-pickers">
        <TemplatePicker v-model="templateId" />
        <ThemePicker v-model="themeId" />
      </div>
      <TemplatePreview :resume="incoming" :template-id="templateId" :theme-id="themeId" />
    </main>
  </div>
</template>

<style scoped>
.received { min-height: 100vh; min-height: 100dvh; }
.rv-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(8px + var(--safe-top)) calc(8px + var(--safe-right)) 8px calc(8px + var(--safe-left));
  border-bottom: 1px solid var(--line);
}
.rv-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.25;
}
.rv-title strong { font-size: 17px; }
.rv-title span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: 13px;
}
.rv-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 16px calc(16px + var(--safe-right)) calc(32px + var(--safe-bottom)) calc(16px + var(--safe-left));
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rv-prompt { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.rv-prompt p { margin: 0 0 6px; line-height: 1.6; }
.rv-inline { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.rv-pickers { display: flex; flex-direction: column; align-items: center; gap: 10px; }
</style>
