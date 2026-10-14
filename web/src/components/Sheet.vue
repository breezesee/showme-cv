<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import Icon from './Icon.vue'

/** 宽屏弹层：点遮罩或按 Esc 关闭 */
defineProps<{ title: string }>()
const open = defineModel<boolean>('open', { required: true })

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}

watch(
  open,
  (v) => {
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @click.self="open = false">
        <div class="sheet" role="dialog" aria-modal="true" :aria-label="title">
          <header class="sheet-head">
            <h2>{{ title }}</h2>
            <button class="sheet-close" type="button" aria-label="关闭" @click="open = false"><Icon name="close" /></button>
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
