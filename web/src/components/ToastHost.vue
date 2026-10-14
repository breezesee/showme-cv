<script setup lang="ts">
import { toasts } from '../ui/toast'
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="'toast-' + t.kind">{{ t.text }}</div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 32px);
}
.toast {
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(28, 28, 30, 0.88);
  color: #fff;
  font-size: 14px;
  line-height: 1.4;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
.toast-success { background: rgba(36, 138, 61, 0.92); }
.toast-error { background: rgba(215, 0, 21, 0.92); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
@media (min-width: 900px) {
  .toast-host { bottom: 32px; }
}
</style>
