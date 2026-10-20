<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { THEMES, type ThemeId } from '../templates/themes'

/** 主题选择器：迷你简历缩微卡（A4 比例），纸面 / 色带 / 标题线按主题着色，所见即所得；方向键切换 */
const model = defineModel<ThemeId>({ required: true })
const groupEl = ref<HTMLElement>()

function onKeydown(e: KeyboardEvent): void {
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const i = THEMES.findIndex((t) => t.id === model.value)
  const next = (i + dir + THEMES.length) % THEMES.length
  model.value = THEMES[next].id
  void nextTick(() => (groupEl.value?.children[next] as HTMLElement | undefined)?.focus())
}
</script>

<template>
  <div ref="groupEl" class="themes" role="radiogroup" aria-label="简历主题" @keydown="onKeydown">
    <button
      v-for="t in THEMES"
      :key="t.id"
      class="mini"
      :class="{ active: model === t.id }"
      type="button"
      role="radio"
      :aria-checked="model === t.id"
      :tabindex="model === t.id ? 0 : -1"
      :aria-label="t.name"
      :title="t.name"
      :style="{ '--a': t.accent }"
      @click="model = t.id"
    >
      <span class="paper" :style="{ background: t.paper }">
        <span v-if="t.band" class="band" :style="{ background: t.band }" />
        <span class="headline" :style="{ background: t.accent }" />
        <span class="body-line w1" />
        <span class="body-line w2" />
        <span class="check">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.7l4.5-5.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </span>
      </span>
      <span class="name">{{ t.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.themes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 4px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
}
.paper {
  position: relative;
  width: 34px;
  height: 44px;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.18s var(--ease, ease), box-shadow 0.18s var(--ease, ease);
}
.mini:hover .paper {
  transform: translateY(-2px);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06), 0 5px 12px rgba(0, 0, 0, 0.12);
}
.mini.active .paper {
  transform: translateY(-2px);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 0 2px var(--a), 0 6px 14px rgba(0, 0, 0, 0.14);
}
.band {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}
.headline {
  position: absolute;
  top: 11px;
  left: 5px;
  width: 55%;
  height: 3.5px;
  border-radius: 2px;
}
.body-line {
  position: absolute;
  left: 5px;
  height: 2px;
  border-radius: 1px;
  background: rgba(0, 0, 0, 0.12);
}
.w1 { top: 20px; right: 9px; }
.w2 { top: 25px; right: 13px; }
.check {
  position: absolute;
  right: 2px;
  bottom: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--a);
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 0.15s, transform 0.15s var(--ease, ease);
}
.check svg { width: 8px; height: 8px; }
.mini.active .check {
  opacity: 1;
  transform: scale(1);
}
.name {
  font-size: 12px;
  line-height: 1;
  color: var(--muted);
  transition: color 0.15s;
}
.mini.active .name {
  color: var(--ink);
  font-weight: 600;
}
@media (max-width: 1099.98px) {
  .themes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px 4px;
  }
  .mini { padding: 4px; }
}
</style>
