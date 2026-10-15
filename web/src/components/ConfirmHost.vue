<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { confirmState, settleConfirm } from '../ui/confirm'

/**
 * 确认弹窗宿主（挂在应用根部，见 App.vue）。
 * 焦点管理与其他弹层一致：打开时聚焦、Tab 在弹窗内循环、关闭后还给原元素。
 */
const cancelBtn = ref<HTMLButtonElement>()
const confirmBtn = ref<HTMLButtonElement>()
let lastFocus: HTMLElement | null = null

watch(
  () => confirmState.current,
  async (current) => {
    if (current) {
      lastFocus = document.activeElement as HTMLElement | null
      await nextTick()
      ;(current.danger ? cancelBtn.value : confirmBtn.value)?.focus()
    } else {
      lastFocus?.focus?.()
      lastFocus = null
    }
  },
)

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    settleConfirm(false)
    return
  }
  if (e.key !== 'Tab') return
  const focusables = [cancelBtn.value, confirmBtn.value].filter((el): el is HTMLButtonElement => !!el)
  if (!focusables.length) return
  e.preventDefault()
  const i = focusables.indexOf(document.activeElement as HTMLButtonElement)
  const next = focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length * 2) % focusables.length]
  next?.focus()
}

onBeforeUnmount(() => {
  confirmState.current?.resolve(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="confirmState.current" class="confirm-backdrop">
        <div class="confirm card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" @keydown="onKeydown">
          <h2 id="confirm-title">{{ confirmState.current.title }}</h2>
          <p>{{ confirmState.current.message }}</p>
          <div class="confirm-actions">
            <button ref="cancelBtn" class="btn btn-block" type="button" @click="settleConfirm(false)">
              {{ confirmState.current.cancelText }}
            </button>
            <button
              ref="confirmBtn"
              class="btn btn-block"
              :class="confirmState.current.danger ? 'btn-danger-solid' : 'btn-primary'"
              type="button"
              @click="settleConfirm(true)"
            >
              {{ confirmState.current.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.28);
}
.confirm {
  width: min(340px, 100%);
  padding: 22px 20px 16px;
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
  text-align: center;
}
.confirm h2 { margin: 0 0 8px; font-size: 17px; font-weight: 600; }
.confirm p { margin: 0 0 18px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.confirm-actions { display: flex; flex-direction: column; gap: 8px; }
.btn-danger-solid { background: var(--danger); color: #fff; }
.btn-danger-solid:hover { box-shadow: 0 6px 16px rgba(255, 59, 48, 0.32); }
.confirm-enter-active, .confirm-leave-active { transition: opacity 0.18s; }
.confirm-enter-active .confirm, .confirm-leave-active .confirm { transition: transform 0.18s var(--ease); }
.confirm-enter-from, .confirm-leave-to { opacity: 0; }
.confirm-enter-from .confirm, .confirm-leave-to .confirm { transform: scale(0.96); }
</style>
