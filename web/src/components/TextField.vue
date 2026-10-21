<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import { insertBulletAt } from '../ui/textarea'

withDefaults(
  defineProps<{
    label: string
    multiline?: boolean
    rows?: number
    type?: 'text' | 'tel' | 'email'
    placeholder?: string
    /** 字段下方的格式说明 */
    hint?: string
    /** 多行字段显示「插入要点」按钮 */
    bullets?: boolean
    /** 最大输入长度，超出后浏览器阻止继续输入 */
    maxlength?: number
  }>(),
  { multiline: false, rows: 3, type: 'text', placeholder: '', hint: '', bullets: false },
)
const emit = defineEmits<{ blur: [] }>()
const model = defineModel<string>({ required: true })
const id = useId()
const area = ref<HTMLTextAreaElement>()

function insertBullet(): void {
  const el = area.value
  const start = el?.selectionStart ?? model.value.length
  const end = el?.selectionEnd ?? start
  const next = insertBulletAt(model.value, start, end)
  model.value = next.text
  void nextTick(() => {
    el?.focus()
    el?.setSelectionRange(next.caret, next.caret)
  })
}
</script>

<template>
  <div class="field">
    <label class="field-label" :for="id">{{ label }}</label>
    <textarea v-if="multiline" :id="id" ref="area" v-model="model" class="field-input field-area" :rows="rows" :placeholder="placeholder" :maxlength="maxlength" @blur="emit('blur')" />
    <input v-else :id="id" v-model="model" class="field-input" :type="type" :placeholder="placeholder" :maxlength="maxlength" autocomplete="off" @blur="emit('blur')" />
    <div v-if="hint || (multiline && bullets)" class="field-foot">
      <p v-if="hint" class="field-hint">{{ hint }}</p>
      <button v-if="multiline && bullets" class="field-action" type="button" @click="insertBullet">插入要点</button>
    </div>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field-label { font-size: 13px; color: var(--muted); padding-left: 4px; }
.field-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 16px; /* 不小于 16px，避免 iOS 聚焦时自动放大页面 */
  outline: none;
  transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.field-input:hover { background: rgba(120, 120, 128, 0.08); }
.field-input:focus {
  border-color: var(--accent);
  background: #fff;
  box-shadow: var(--ring);
}
.field-area { resize: vertical; line-height: 1.6; }
.field-foot { display: flex; align-items: center; gap: 8px; padding-left: 4px; }
.field-hint { flex: 1; margin: 0; font-size: 12px; color: var(--muted); }
.field-action {
  flex: none;
  min-height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: var(--fill);
  color: var(--accent);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
}
.field-action:active { background: var(--fill-strong); }
</style>
