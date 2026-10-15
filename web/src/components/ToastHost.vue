<script setup lang="ts">
import { removeToast, toasts, type Toast } from '../ui/toast'

function runAction(t: Toast): void {
  t.action?.run()
  removeToast(t.id)
}
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="'toast-' + t.kind"
        :role="t.kind === 'error' ? 'alert' : 'status'"
      >
        <span class="toast-text">{{ t.text }}</span>
        <button v-if="t.action" class="toast-action" type="button" @click="runAction(t)">{{ t.action.label }}</button>
      </div>
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
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 100%;
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
.toast-text { min-width: 0; }
.toast-action {
  flex: none;
  margin: -6px -8px -6px 0;
  padding: 6px 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #6cb2ff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  pointer-events: auto;
}
.toast-action:active { background: rgba(255, 255, 255, 0.14); }
@media (max-width: 1099.98px) {
  .toast-action { min-height: 44px; padding: 6px 14px; }
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
@media (min-width: 1100px) {
  .toast-host { bottom: 32px; }
}
</style>
