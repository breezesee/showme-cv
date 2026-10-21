<script setup lang="ts">
import { computed } from 'vue'
import type { ShareFailure } from '../relay/shareSession'
import Icon, { type IconName } from './Icon.vue'

/** 分享取回中的加载态与失败态：失败时说明原因并给出退出/重试出口 */
export type ShareGateState = 'loading' | ShareFailure

const props = defineProps<{ state: ShareGateState; retryable?: boolean }>()
const emit = defineEmits<{ close: []; retry: [] }>()

const copy = computed<{ title: string; message: string; icon: IconName }>(() => {
  switch (props.state) {
    case 'loading':
      return { title: '正在打开分享的简历…', message: '链接有效时会直接显示内容。', icon: 'eye' }
    case 'expired':
      return { title: '这份分享已结束', message: '链接已过期，或发送者已撤回分享。', icon: 'lock' }
    case 'broken':
      return { title: '分享链接无效', message: '链接可能不完整或已损坏，请让对方重新分享。', icon: 'alert' }
    case 'network':
      return { title: '暂时无法取回分享', message: '网络似乎不太稳定，请稍后重试。', icon: 'alert' }
    default:
      return { title: '暂时无法取回分享', message: '分享服务暂时不可用，请稍后重试。', icon: 'alert' }
  }
})
</script>

<template>
  <div class="gate" role="status" aria-live="polite">
    <div class="gate-card">
      <span class="gate-mark" aria-hidden="true">
        <span v-if="state === 'loading'" class="spinner" />
        <Icon v-else :name="copy.icon" />
      </span>
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.message }}</p>
      <div class="gate-actions">
        <button v-if="retryable" class="btn btn-primary" type="button" @click="emit('retry')">重试</button>
        <button class="btn" :class="{ 'btn-primary': !retryable }" type="button" @click="emit('close')">
          查看我的简历
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gate {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: calc(24px + var(--safe-top)) calc(20px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(20px + var(--safe-left));
}
.gate-card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 34px 24px 26px;
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
  text-align: center;
}
.gate-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: var(--fill);
  color: var(--muted);
}
.gate-mark svg { width: 24px; height: 24px; }
.gate-card h1 { margin: 0; font-size: 21px; font-weight: 700; line-height: 1.3; }
.gate-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
.gate-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
.gate-actions .btn { min-width: 124px; }
.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: gate-spin 0.8s linear infinite;
}
@keyframes gate-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
</style>
