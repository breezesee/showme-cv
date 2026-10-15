<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{ title: string; meta?: string }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <section class="section card">
    <button class="section-head" type="button" :aria-expanded="open" @click="open = !open">
      <span class="section-title">{{ title }}</span>
      <span v-if="meta" class="section-meta">{{ meta }}</span>
      <Icon name="chevron" class="section-chevron" :class="{ open }" />
    </button>
    <!-- grid-rows 0fr→1fr 实现高度自适应的平滑展开；收起时 inert 让内容退出交互与读屏 -->
    <div class="section-wrap" :class="{ open }" :inert="!open || undefined">
      <div class="section-body">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.section { overflow: hidden; }
.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 56px;
  padding: 0 16px 0 20px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}
@media (hover: hover) {
  .section-head:hover { background: rgba(0, 0, 0, 0.025); }
}
.section-title { flex: none; font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }
.section-meta {
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: 14px;
}
.section-chevron {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--disabled);
  transition: transform 0.3s var(--ease);
}
.section-meta + .section-chevron { margin-left: 4px; }
.section-head > .section-title + .section-chevron { margin-left: auto; }
.section-chevron.open { transform: rotate(90deg); }
.section-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s var(--ease);
}
.section-wrap.open { grid-template-rows: 1fr; }
.section-body {
  min-height: 0;
  overflow: hidden;
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
