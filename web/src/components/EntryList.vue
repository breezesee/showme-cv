<script setup lang="ts" generic="T">
import Icon from './Icon.vue'

/** 通用条目列表：增删、上移下移；条目字段由默认插槽渲染 */
const props = defineProps<{
  items: T[]
  noun: string
  create: () => T
  summary: (item: T) => string
}>()

function move(i: number, delta: number) {
  const j = i + delta
  if (j < 0 || j >= props.items.length) return
  const [it] = props.items.splice(i, 1)
  props.items.splice(j, 0, it)
}

function remove(i: number) {
  const s = props.summary(props.items[i]).trim()
  if (!window.confirm(`删除这条${props.noun}${s ? `「${s}」` : ''}？`)) return
  props.items.splice(i, 1)
}

function add() {
  props.items.push(props.create())
}
</script>

<template>
  <div class="entries">
    <div v-for="(item, i) in items" :key="i" class="entry">
      <div class="entry-bar">
        <span class="entry-name">{{ summary(item).trim() || `未命名${noun}` }}</span>
        <button class="icon-btn" type="button" :disabled="i === 0" :aria-label="`上移第 ${i + 1} 条`" @click="move(i, -1)">
          <Icon name="up" />
        </button>
        <button class="icon-btn" type="button" :disabled="i === items.length - 1" :aria-label="`下移第 ${i + 1} 条`" @click="move(i, 1)">
          <Icon name="down" />
        </button>
        <button class="icon-btn danger" type="button" :aria-label="`删除第 ${i + 1} 条`" @click="remove(i)">
          <Icon name="trash" />
        </button>
      </div>
      <div class="entry-fields">
        <slot :item="item" :index="i" />
      </div>
    </div>
    <button class="btn btn-plain add-btn" type="button" @click="add">
      <Icon name="plus" />添加{{ noun }}
    </button>
  </div>
</template>

<style scoped>
.entries { display: flex; flex-direction: column; gap: 12px; }
.entry {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 4px 12px 14px;
}
.entry-bar { display: flex; align-items: center; gap: 2px; min-height: 48px; }
.entry-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
.icon-btn svg { width: 20px; height: 20px; }
.icon-btn:active:not(:disabled) { background: var(--fill); }
.icon-btn:disabled { color: #c7c7cc; cursor: default; }
.icon-btn.danger { color: var(--danger); }
.entry-fields { display: flex; flex-direction: column; gap: 12px; }
.add-btn { align-self: flex-start; min-height: 44px; }
</style>
