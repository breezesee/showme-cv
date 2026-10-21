<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { parseResumeText, type ParseStats, type ParsedResumeText } from '../import/textResume'
import { useResume } from '../store/useResume'
import { confirmOverwrite } from '../ui/actions'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'

/** 粘贴纯文本导入：先识别预览，确认后替换为未保存草稿 */
const emit = defineEmits<{ imported: [] }>()
const { replaceResume } = useResume()

const text = ref('')
const parsed = ref<ParsedResumeText | null>(null)
const failure = ref('')
const importing = ref(false)

function describe(stats: ParseStats): string[] {
  const list: string[] = []
  if (stats.basics) list.push('基本信息')
  if (stats.education) list.push(`教育 ${stats.education} 段`)
  if (stats.work) list.push(`工作 ${stats.work} 段`)
  if (stats.projects) list.push(`项目 ${stats.projects} 个`)
  if (stats.skills) list.push(`技能 ${stats.skills} 组`)
  if (stats.custom) list.push(`自定义 ${stats.custom} 个`)
  return list
}

const chips = computed(() => (parsed.value ? describe(parsed.value.stats) : []))
const parsedName = computed(() => {
  const basics = parsed.value?.resume.basics
  if (!basics) return ''
  return [basics.name, basics.title].filter(Boolean).join(' · ')
})

watch(text, () => {
  parsed.value = null
  failure.value = ''
})

function parse(): void {
  failure.value = ''
  if (!text.value.trim()) {
    parsed.value = null
    failure.value = '请先粘贴简历文本。'
    return
  }
  const result = parseResumeText(text.value)
  if (!describe(result.stats).length) {
    parsed.value = null
    failure.value = '没有识别到有效内容。请保留「教育经历」「工作经历」等小标题，或检查粘贴的是否为简历文字。'
    return
  }
  parsed.value = result
}

async function confirmImport(): Promise<void> {
  const result = parsed.value
  if (!result || importing.value) return
  if (!(await confirmOverwrite(result.resume))) return
  importing.value = true
  try {
    replaceResume(result.resume)
    text.value = ''
    parsed.value = null
    showToast('已导入，检查后请点击「保存」', 'success')
    emit('imported')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="paste">
    <label class="paste-label" for="paste-text">简历文本</label>
    <textarea
      id="paste-text"
      v-model="text"
      class="paste-area"
      rows="7"
      placeholder="从 Word、PDF 或招聘网站复制简历文字粘贴到这里，例如：&#10;教育经历&#10;2015.09 - 2019.06  复旦大学  信息管理  本科"
    />

    <div class="paste-actions">
      <button class="btn" type="button" :disabled="importing" @click="parse">
        <Icon name="eye" />识别内容
      </button>
      <button v-if="parsed" class="btn btn-primary" type="button" :disabled="importing" @click="confirmImport">
        <Icon name="check" />{{ importing ? '导入中…' : '导入为草稿' }}
      </button>
    </div>

    <p v-if="failure" class="notice" role="alert">{{ failure }}</p>

    <div v-if="parsed" class="result">
      <div class="result-head">
        <span class="result-title">识别结果</span>
        <span v-if="parsedName" class="result-name">{{ parsedName }}</span>
      </div>
      <ul class="result-chips">
        <li v-for="chip in chips" :key="chip">{{ chip }}</li>
      </ul>
      <p class="hint">导入会替换当前编辑中的内容，并成为一份未保存草稿。识别不准的地方导入后可以继续修改。</p>
    </div>
  </div>
</template>

<style scoped>
.paste { display: flex; flex-direction: column; gap: 10px; }
.paste-label { color: var(--muted); font-size: 13px; padding-left: 4px; }
.paste-area {
  width: 100%;
  min-height: 132px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 16px; /* 不小于 16px，避免 iOS 聚焦时自动放大页面 */
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.paste-area:hover { background: rgba(120, 120, 128, 0.08); }
.paste-area:focus {
  border-color: var(--accent);
  background: #fff;
  box-shadow: var(--ring);
}
.paste-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.paste-actions .btn { min-height: 40px; }
.result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.result-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.result-title { color: var(--muted); font-size: 12.5px; }
.result-name { font-size: 14px; font-weight: 600; }
.result-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.result-chips li {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--fill);
  color: var(--muted);
  font-size: 12px;
}
.result .hint { margin: 0; }
</style>
