<script setup lang="ts">
import { computed } from 'vue'
import TextField from './TextField.vue'

/**
 * 多行列表输入：每行一条。
 * 文本 ⇄ 数组按 '\n' 无损互转（不过滤空行），回车换行不会被吞掉；空行由模板渲染时跳过。
 */
withDefaults(defineProps<{ label: string; rows?: number; placeholder?: string }>(), { rows: 4, placeholder: '' })
const lines = defineModel<string[]>({ required: true })

const text = computed({
  get: () => lines.value.join('\n'),
  set: (v: string) => {
    lines.value = v === '' ? [] : v.split('\n')
  },
})
</script>

<template>
  <TextField v-model="text" :label="label" :rows="rows" :placeholder="placeholder" multiline />
</template>
