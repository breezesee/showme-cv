<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CHECK_LEVEL_LABEL, checkResume, type CheckLevel, type CheckIssue } from '../check/resumeCheck'
import { useResume } from '../store/useResume'
import Icon from './Icon.vue'

/** 投递前检查：本地规则即时计算，不读取或上传简历之外的数据 */
defineProps<{ compact?: boolean }>()
const emit = defineEmits<{ 'edit-target': [target: string] }>()
const { resume } = useResume()

const issues = computed(() => checkResume(resume.value))
const counts = computed(() => ({
  error: issues.value.filter((item) => item.level === 'error').length,
  warn: issues.value.filter((item) => item.level === 'warn').length,
  tip: issues.value.filter((item) => item.level === 'tip').length,
}))
const expanded = ref(false)
onMounted(() => {
  expanded.value = counts.value.error > 0
})

const SEVERITY: Record<CheckLevel, number> = { error: 0, warn: 1, tip: 2 }
const sorted = computed(() => [...issues.value].sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level]))

const headline = computed(() => {
  if (counts.value.error) return `${counts.value.error} 项需要先修改`
  if (counts.value.warn) return `${counts.value.warn} 项建议检查`
  if (counts.value.tip) return `${counts.value.tip} 项可以更好`
  return '没有发现问题'
})
const countText = computed(() => {
  const parts: string[] = []
  if (counts.value.error) parts.push(`${counts.value.error} 项必须修改`)
  if (counts.value.warn) parts.push(`${counts.value.warn} 项建议检查`)
  if (counts.value.tip) parts.push(`${counts.value.tip} 项可以更好`)
  return parts.join(' · ')
})
const levelClass = computed(() => (counts.value.error ? 'error' : counts.value.warn ? 'warn' : counts.value.tip ? 'tip' : 'ok'))

function go(issue: CheckIssue): void {
  emit('edit-target', issue.target)
}
</script>

<template>
  <section :class="compact ? 'check-compact' : 'card block'">
    <header v-if="!compact" class="zone-head">
      <h3>投递前检查</h3>
      <p class="hint">在本地完成，不上传简历内容。</p>
    </header>

    <button
      class="check-summary"
      type="button"
      :aria-expanded="expanded && issues.length > 0"
      :disabled="issues.length === 0"
      @click="expanded = !expanded"
    >
      <span class="status" :class="levelClass"><Icon :name="issues.length ? 'alert' : 'check'" /></span>
      <span class="summary-main">
        <b>{{ headline }}</b>
        <small>{{ issues.length ? countText : '姓名、联系方式与经历都齐了，可以放心投递。' }}</small>
      </span>
      <Icon v-if="issues.length" name="chevron" class="chevron" :class="{ open: expanded }" />
    </button>

    <ul v-if="expanded && issues.length" class="issues">
      <li v-for="issue in sorted" :key="issue.id" class="issue" :class="issue.level">
        <div class="issue-top">
          <span class="level-tag">{{ CHECK_LEVEL_LABEL[issue.level] }}</span>
          <span class="issue-title">{{ issue.title }}</span>
        </div>
        <p class="issue-detail">{{ issue.detail }}</p>
        <button class="go" type="button" @click="go(issue)">
          去修改<Icon name="chevron" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.block { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.check-compact { display: flex; flex-direction: column; gap: 8px; }
.zone-head { display: flex; flex-direction: column; gap: 2px; }
.zone-head h3 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }
.zone-head .hint { margin: 0; }

.check-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg);
  text-align: left;
  cursor: pointer;
}
.check-summary:disabled { cursor: default; }
.status {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
}
.status svg { width: 19px; height: 19px; }
.status.ok { background: rgba(52, 199, 89, 0.12); color: #248a3d; }
.status.tip { background: rgba(0, 113, 227, 0.1); color: var(--accent); }
.status.warn { background: var(--warning-bg); color: var(--warning); }
.status.error { background: rgba(255, 59, 48, 0.1); color: var(--danger); }
.summary-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.summary-main b { font-size: 15px; font-weight: 600; }
.summary-main small { color: var(--muted); font-size: 12.5px; }
.chevron { flex: none; width: 18px; height: 18px; color: var(--disabled); transition: transform 0.25s var(--ease); }
.chevron.open { transform: rotate(90deg); }

.issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.issue {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  border-left: 3px solid var(--disabled);
}
.issue.error { border-left-color: var(--danger); }
.issue.warn { border-left-color: #ff9f0a; }
.issue.tip { border-left-color: var(--accent); }
.issue-top { display: flex; align-items: center; gap: 8px; }
.level-tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--fill);
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}
.issue.error .level-tag { background: rgba(255, 59, 48, 0.1); color: var(--danger); }
.issue.warn .level-tag { background: var(--warning-bg); color: var(--warning); }
.issue.tip .level-tag { background: rgba(0, 113, 227, 0.1); color: var(--accent); }
.issue-title { font-size: 14px; font-weight: 600; }
.issue-detail { margin: 4px 0 0; color: var(--muted); font-size: 12.5px; line-height: 1.55; }
.go {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 32px;
  margin-top: 4px;
  padding: 0 4px;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
}
.go svg { width: 14px; height: 14px; }
.go:hover { text-decoration: underline; }
</style>
