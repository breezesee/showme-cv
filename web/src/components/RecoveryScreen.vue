<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { account, requestPasswordReset } from '../cloud/account'
import { authErrorMessage } from '../cloud/authErrors'
import { emailError, normalizeEmail } from '../model/email'
import { useResume } from '../store/useResume'
import Icon from './Icon.vue'

/** 邮件链接落地页：设置新密码；链接失效时可直接重发 */
const emit = defineEmits<{ close: [] }>()

const { recoveryActive, recoveryError, submitNewPassword, finishRecovery } = useResume()

const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

const resendEmail = ref('')
const resendBusy = ref(false)
const resendSent = ref(false)
const resendError = ref('')

const dialogEl = ref<HTMLElement>()
const closeBtn = ref<HTMLButtonElement>()
const passwordInput = ref<HTMLInputElement>()

const expired = computed(() => !account.ready || !!recoveryError.value)
const description = computed(() =>
  recoveryError.value || '链接已失效',
)

watch(recoveryActive, async (active) => {
  if (typeof document !== 'undefined') document.body.style.overflow = active ? 'hidden' : ''
  if (!active) return
  password.value = ''
  confirm.value = ''
  error.value = ''
  resendEmail.value = account.email
  resendSent.value = false
  resendError.value = ''
  await nextTick()
  if (expired.value) closeBtn.value?.focus()
  else passwordInput.value?.focus()
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key !== 'Tab' || !dialogEl.value) return
  const list = [...dialogEl.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
  if (!list.length) return
  const i = list.indexOf(document.activeElement as HTMLElement)
  const next = list[(i + (e.shiftKey ? -1 : 1) + list.length * 2) % list.length]
  if (i < 0 || !next) e.preventDefault()
  next?.focus()
}

function close(): void {
  finishRecovery()
  emit('close')
}

async function submit(): Promise<void> {
  if (busy.value) return
  if (password.value.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (password.value !== confirm.value) {
    error.value = '两次密码不一致'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await submitNewPassword(password.value)
    emit('close')
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function resend(): Promise<void> {
  if (resendBusy.value) return
  const problem = emailError(resendEmail.value)
  if (problem) {
    resendError.value = problem
    return
  }
  resendBusy.value = true
  resendError.value = ''
  try {
    await requestPasswordReset(normalizeEmail(resendEmail.value))
    resendSent.value = true
  } catch (e) {
    resendError.value = authErrorMessage(e)
  } finally {
    resendBusy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="recovery">
      <div v-if="recoveryActive" class="recovery-backdrop">
        <div
          ref="dialogEl"
          class="recovery-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recovery-title"
          @keydown="onKey"
        >
          <button ref="closeBtn" class="close" type="button" aria-label="关闭" @click="close">
            <Icon name="close" />
          </button>

          <span class="mark" aria-hidden="true"><Icon name="lock" /></span>
          <h2 id="recovery-title">{{ expired ? '重置链接已失效' : '设置新密码' }}</h2>

          <template v-if="expired">
            <p class="hint">{{ description }}。输入注册邮箱，我们会重新发送一封。</p>
            <form class="form" novalidate @submit.prevent="resend">
              <label class="field-label" for="recovery-email">注册邮箱</label>
              <input
                id="recovery-email"
                v-model="resendEmail"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="you@example.com"
              />
              <p v-if="resendError" class="form-error" role="alert">{{ resendError }}</p>
              <p v-if="resendSent" class="sent-line" role="status">
                如果该邮箱已注册，重置邮件会很快到达，请检查收件箱和垃圾邮件。
              </p>
              <button class="btn btn-primary btn-block" type="submit" :disabled="resendBusy">
                {{ resendBusy ? '发送中…' : '重新发送重置邮件' }}
              </button>
            </form>
            <button class="btn btn-block" type="button" @click="close">返回站点</button>
          </template>

          <template v-else>
            <p class="hint">为 <b>{{ account.email }}</b> 设置新密码。完成后，其他设备需要重新登录。</p>
            <form class="form" @submit.prevent="submit">
              <label class="field-label" for="recovery-password">新密码</label>
              <input
                id="recovery-password"
                ref="passwordInput"
                v-model="password"
                type="password"
                autocomplete="new-password"
                placeholder="至少 6 位"
              />
              <label class="field-label" for="recovery-confirm">确认新密码</label>
              <input
                id="recovery-confirm"
                v-model="confirm"
                type="password"
                autocomplete="new-password"
                placeholder="再输入一次"
              />
              <p v-if="error" class="form-error" role="alert">{{ error }}</p>
              <button class="btn btn-primary btn-block" type="submit" :disabled="busy">
                {{ busy ? '保存中…' : '更新密码' }}
              </button>
            </form>
            <button class="link-btn" type="button" @click="close">暂不修改</button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.recovery-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.32);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
.recovery-card {
  position: relative;
  width: min(100%, 420px);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 26px 26px 22px;
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow-lg);
}
.close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.close:hover { background: var(--fill); }
.close svg { width: 18px; height: 18px; }
.mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: rgba(0, 113, 227, 0.1);
  color: var(--accent);
}
.mark svg { width: 22px; height: 22px; }
h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.2px; }
.hint { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
.hint b { color: var(--ink); font-weight: 550; word-break: break-all; }
.form { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
.field-label { color: var(--muted); font-size: 12px; font-weight: 500; }
.field-label:not(:first-child) { margin-top: 4px; }
input {
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
input:focus { border-color: var(--accent); box-shadow: var(--ring); }
.form-error { margin: 0; color: var(--danger); font-size: 13px; line-height: 1.5; }
.sent-line { margin: 0; color: var(--success); font-size: 13px; line-height: 1.55; }
.form .btn { margin-top: 4px; }
.link-btn {
  align-self: center;
  padding: 2px 6px;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.link-btn:hover { color: var(--accent); }

.recovery-enter-active, .recovery-leave-active { transition: opacity 0.22s var(--ease); }
.recovery-enter-active .recovery-card, .recovery-leave-active .recovery-card {
  transition: transform 0.22s var(--ease), opacity 0.22s var(--ease);
}
.recovery-enter-from, .recovery-leave-to { opacity: 0; }
.recovery-enter-from .recovery-card, .recovery-leave-to .recovery-card {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 1099.98px) {
  .recovery-backdrop { align-items: flex-end; padding: 0; }
  .recovery-card {
    width: 100%;
    max-height: 92dvh;
    padding: 26px 22px calc(22px + var(--safe-bottom));
    border-radius: 22px 22px 0 0;
  }
}
</style>
