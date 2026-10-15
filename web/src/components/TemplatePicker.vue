<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { TEMPLATES, type TemplateId } from '../templates/catalog'

/** iOS 风分段控件：选择模板；方向键在选项间移动并选中 */
const model = defineModel<TemplateId>({ required: true })
const groupEl = ref<HTMLElement>()

function onKeydown(e: KeyboardEvent): void {
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const i = TEMPLATES.findIndex((t) => t.id === model.value)
  const next = (i + dir + TEMPLATES.length) % TEMPLATES.length
  model.value = TEMPLATES[next].id
  void nextTick(() => (groupEl.value?.children[next] as HTMLElement | undefined)?.focus())
}
</script>

<template>
  <div ref="groupEl" class="seg" role="radiogroup" aria-label="简历模板" @keydown="onKeydown">
    <button
      v-for="t in TEMPLATES"
      :key="t.id"
      class="seg-item"
      :class="{ active: model === t.id }"
      type="button"
      role="radio"
      :aria-checked="model === t.id"
      :tabindex="model === t.id ? 0 : -1"
      @click="model = t.id"
    >
      {{ t.name }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  padding: 2px;
  border-radius: 11px;
  background: var(--fill);
}
.seg-item {
  min-width: 64px;
  min-height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
  transition: background-color 0.2s var(--ease), box-shadow 0.2s var(--ease), color 0.2s var(--ease);
}
@media (hover: hover) {
  .seg-item:not(.active):hover { color: var(--muted); }
}
.seg-item.active {
  background: #fff;
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.08);
}
@media (max-width: 1099.98px) {
  .seg { display: flex; }
  .seg-item { flex: 1; min-height: 44px; }
}
</style>
