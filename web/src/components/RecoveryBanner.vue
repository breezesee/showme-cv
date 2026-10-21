<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

/** 启动时检测到未保存的本地草稿：由用户决定恢复或忽略 */
const props = defineProps<{ at: number }>()
const emit = defineEmits<{ restore: []; dismiss: [] }>()

const label = computed(() => {
  const draft = new Date(props.at)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(draft.getHours())}:${pad(draft.getMinutes())}`
  const sameDay =
    draft.getFullYear() === now.getFullYear() &&
    draft.getMonth() === now.getMonth() &&
    draft.getDate() === now.getDate()
  return sameDay ? `今天 ${time}` : `${draft.getMonth() + 1} 月 ${draft.getDate()} 日 ${time}`
})
</script>

<template>
  <div class="recovery" role="region" aria-label="未保存草稿恢复">
    <Icon name="alert" class="recovery-icon" />
    <div class="recovery-text">
      <b>检测到上次未保存的修改</b>
      <span>{{ label }} · 恢复后可继续编辑，确认无误再保存</span>
    </div>
    <div class="recovery-actions">
      <button class="btn" type="button" @click="emit('restore')">恢复</button>
      <button class="btn btn-plain" type="button" @click="emit('dismiss')">忽略</button>
    </div>
  </div>
</template>

<style scoped>
.recovery {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid rgba(196, 146, 63, 0.32);
  border-radius: var(--radius);
  background: var(--warning-bg);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}
.recovery-icon { flex: none; width: 20px; height: 20px; color: var(--warning); }
.recovery-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; line-height: 1.45; }
.recovery-text b { font-weight: 600; }
.recovery-text span { color: var(--muted); font-size: 12.5px; }
.recovery-actions { flex: none; display: flex; gap: 6px; }
.recovery-actions .btn { min-height: 34px; padding: 0 14px; font-size: 13.5px; }
@media (max-width: 560px) {
  .recovery { align-items: flex-start; flex-wrap: wrap; }
  .recovery-text { flex-basis: calc(100% - 32px); }
  .recovery-actions { width: 100%; justify-content: flex-end; }
}
</style>
