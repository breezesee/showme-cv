<script setup lang="ts">
import type { BasicExtra } from '../model/resume'
import Icon from './Icon.vue'

/** 基本信息附加项：名称可留空（只展示内容），有内容的行与联系方式同排渲染 */
const extras = defineModel<BasicExtra[]>({ required: true })

/** 页头联系方式一行放得下的上限 */
const MAX_EXTRAS = 6

function add(): void {
  if (extras.value.length >= MAX_EXTRAS) return
  extras.value.push({ label: '', value: '' })
}

function remove(i: number): void {
  extras.value = extras.value.filter((_, index) => index !== i)
}
</script>

<template>
  <div class="extras">
    <div class="extras-head">
      <span class="extras-title">附加信息</span>
      <button class="add" type="button" :disabled="extras.length >= MAX_EXTRAS" @click="add"><Icon name="plus" />添加</button>
    </div>
    <p v-if="extras.length >= MAX_EXTRAS" class="hint">最多添加 {{ MAX_EXTRAS }} 条；更多信息可写进「自我评价」或自定义模块</p>
    <div v-for="(item, i) in extras" :key="i" class="extra-row">
      <input
        v-model="item.label"
        class="extra-input extra-label"
        type="text"
        placeholder="名称，如 微信"
        :aria-label="`第 ${i + 1} 条附加信息的名称`"
        autocomplete="off"
      />
      <input
        v-model="item.value"
        class="extra-input"
        type="text"
        placeholder="内容"
        :aria-label="`第 ${i + 1} 条附加信息的内容`"
        autocomplete="off"
      />
      <button class="remove" type="button" :aria-label="`删除第 ${i + 1} 条附加信息`" @click="remove(i)">
        <Icon name="trash" />
      </button>
    </div>
    <p v-if="!extras.length" class="hint">可添加微信、个人主页等，与电话、邮箱显示在同一行</p>
  </div>
</template>

<style scoped>
.extras { display: flex; flex-direction: column; gap: 8px; }
.extras-head { display: flex; align-items: center; gap: 8px; padding-left: 4px; }
.extras-title { flex: 1; font-size: 13px; color: var(--muted); }
.add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  background: var(--fill);
  color: var(--accent);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
}
.add svg { width: 15px; height: 15px; }
.add:disabled { opacity: 0.5; cursor: default; }
.extra-row { display: flex; align-items: center; gap: 6px; }
.extra-input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.extra-label { flex: 0 0 34%; }
.extra-input:hover { background: rgba(120, 120, 128, 0.08); }
.extra-input:focus { border-color: var(--accent); background: #fff; box-shadow: var(--ring); }
.remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
}
.remove svg { width: 18px; height: 18px; }
.remove:active { background: var(--fill); }
</style>
