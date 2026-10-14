<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    label: string
    multiline?: boolean
    rows?: number
    type?: 'text' | 'tel' | 'email'
    placeholder?: string
    /** 字段下方的格式说明 */
    hint?: string
  }>(),
  { multiline: false, rows: 3, type: 'text', placeholder: '', hint: '' },
)
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="field">
    <label class="field-label" :for="id">{{ label }}</label>
    <textarea v-if="multiline" :id="id" v-model="model" class="field-input field-area" :rows="rows" :placeholder="placeholder" />
    <input v-else :id="id" v-model="model" class="field-input" :type="type" :placeholder="placeholder" autocomplete="off" />
    <p v-if="hint" class="field-hint">{{ hint }}</p>
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
.field-hint { margin: 0; padding-left: 4px; font-size: 12px; color: var(--muted); }
</style>
