<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'

/** 宽屏弹层：点遮罩或按 Esc 关闭；打开时聚焦、Tab 在弹层内循环、关闭后焦点还给触发元素 */
defineProps<{ title: string }>()
const open = defineModel<boolean>('open', { required: true })

const sheetEl = ref<HTMLElement>()
const closeBtn = ref<HTMLButtonElement>()
let lastFocus: HTMLElement | null = null

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  if (!sheetEl.value) return []
  return [...sheetEl.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
}

watch(open, async (v) => {
  if (v) {
    lastFocus = document.activeElement as HTMLElement | null
    await nextTick()
    closeBtn.value?.focus()
  } else if (lastFocus) {
    lastFocus.focus()
    lastFocus = null
  }
})

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
    return
  }
  if (e.key !== 'Tab') return
  const list = focusables()
  if (!list.length) {
    e.preventDefault()
    return
  }
  const i = list.indexOf(document.activeElement as HTMLElement)
  const next = list[(i + (e.shiftKey ? -1 : 1) + list.length * 2) % list.length]
  if (i < 0 || !next) e.preventDefault()
  next?.focus()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @click.self="open = false">
        <div
          ref="sheetEl"
          class="sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          @keydown="onKey"
        >
          <header class="sheet-head">
            <h2>{{ title }}</h2>
            <button ref="closeBtn" class="sheet-close" type="button" aria-label="关闭" @click="open = false"><Icon name="close" /></button>
          </header>
          <div class="sheet-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.28);
}
.sheet {
  display: flex;
  flex-direction: column;
  width: min(520px, 100%);
  max-height: calc(100vh - 48px);
  border-radius: 20px;
  background: var(--bg);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}
.sheet-head {
  display: flex;
  align-items: center;
  padding: 14px 12px 6px 24px;
}
.sheet-head h2 { flex: 1; margin: 0; font-size: 20px; font-weight: 700; }
.sheet-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--fill);
  color: var(--muted);
  cursor: pointer;
}
.sheet-close svg { width: 16px; height: 16px; }
.sheet-body { overflow-y: auto; padding: 10px 20px 20px; }
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.2s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(12px) scale(0.98); }
</style>
