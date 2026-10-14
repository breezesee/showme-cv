<script setup lang="ts">
import { TEMPLATES, type TemplateId } from '../templates/catalog'

/** iOS 风分段控件：选择模板 */
const model = defineModel<TemplateId>({ required: true })
</script>

<template>
  <div class="seg" role="radiogroup" aria-label="简历模板">
    <button
      v-for="t in TEMPLATES"
      :key="t.id"
      class="seg-item"
      :class="{ active: model === t.id }"
      type="button"
      role="radio"
      :aria-checked="model === t.id"
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
@media (max-width: 899.98px) {
  .seg { display: flex; }
  .seg-item { flex: 1; min-height: 44px; }
}
</style>
