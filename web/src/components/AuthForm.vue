<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { requestPasswordReset } from '../cloud/account'
import { authErrorMessage } from '../cloud/authErrors'
import { emailError, normalizeEmail } from '../model/email'
import { login, register, useResume } from '../store/useResume'
import Icon from './Icon.vue'

/** 登录 / 注册 / 找回密码：桌面个人中心与手机「我的」页共用 */
const { account } = useResume()

type Mode = 'login' | 'register' | 'forgot'
const mode = ref<Mode>('login')
const email = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')
const emailTouched = ref(false)
const sent = ref(false)
const cooldown = ref(0)
const emailInput = ref<HTMLInputElement>()
let timer: number | undefined

const emailFieldError = computed(() => (emailTouched.value ? emailError(email.value) : null))
const sentTo = computed(() => normalizeEmail(email.value))

const title = computed(() => {
  if (mode.value === 'forgot') return '找回密码'
  return mode.value === 'login' ? '登录账号' : '创建账号'
})

const subtitle = computed(() => {
  if (mode.value === 'forgot') return '输入注册邮箱，我们会发送重置链接。'
  return mode.value === 'login' ? '登录后打开你的云端简历库。' : '注册后即可把简历保存到云端，换设备不丢。'
})

const actionText = computed(() => {
  if (busy.value) return '请稍候…'
  if (mode.value === 'forgot') return sent.value ? '重新发送' : '发送重置邮件'
  return mode.value === 'login' ? '登录' : '创建账号'
})

function startCooldown(): void {
  stopTimer()
  cooldown.value = 60
  timer = window.setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) stopTimer()
  }, 1000)
}

function stopTimer(): void {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

onBeforeUnmount(stopTimer)

function validate(): string | null {
  if (!account.available) return '云端服务未配置，暂时无法登录'
  const mailProblem = emailError(email.value)
  if (mailProblem) {
    emailTouched.value = true
    return mailProblem
  }
  if (mode.value === 'forgot') return null
  if (password.value.length < 6) return '密码至少 6 位'
  if (mode.value === 'register' && password.value !== confirm.value) return '两次密码不一致'
  return null
}

async function submitReset(): Promise<void> {
  if (cooldown.value > 0) return
  busy.value = true
  error.value = ''
  try {
    await requestPasswordReset(normalizeEmail(email.value))
    sent.value = true
    startCooldown()
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function submit(): Promise<void> {
  const message = validate()
  if (message) {
    // 邮箱问题已在输入框下方就地提示，避免同一条错误出现两次
    error.value = emailError(email.value) ? '' : message
    return
  }
  if (mode.value === 'forgot') {
    await submitReset()
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (mode.value === 'login') await login(normalizeEmail(email.value), password.value)
    else await register(normalizeEmail(email.value), password.value)
    password.value = ''
    confirm.value = ''
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function switchMode(next: Mode): Promise<void> {
  mode.value = next
  error.value = ''
  emailTouched.value = false
  sent.value = false
  confirm.value = ''
  password.value = ''
  stopTimer()
  cooldown.value = 0
  await nextTick()
  emailInput.value?.focus()
}
</script>

<template>
  <div class="auth">
    <header class="auth-head">
      <h3>{{ title }}</h3>
      <p class="hint">{{ subtitle }}</p>
    </header>

    <!-- 重置邮件已发送：明确下一步，避免用户停在空表单 -->
    <div v-if="mode === 'forgot' && sent" class="sent" role="status">
      <span class="sent-mark" aria-hidden="true"><Icon name="mail" /></span>
      <p class="sent-title">请查收邮件</p>
      <p class="hint">
        如果 <b>{{ sentTo }}</b> 已注册，你会收到一封设置新密码的邮件。没收到请检查垃圾邮件；稍等几分钟再试。
      </p>
      <div class="sent-actions">
        <button class="btn" type="button" :disabled="cooldown > 0 || busy" @click="submitReset">
          {{ cooldown > 0 ? `${cooldown} 秒后可重发` : '重新发送' }}
        </button>
        <button class="btn btn-primary" type="button" @click="switchMode('login')">返回登录</button>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </div>

    <form v-else class="auth-form" novalidate @submit.prevent="submit">
      <div class="field">
        <label class="field-label" for="auth-email">邮箱</label>
        <input
          id="auth-email"
          ref="emailInput"
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
          :aria-invalid="!!emailFieldError"
          :aria-describedby="emailFieldError ? 'auth-email-error' : undefined"
          @blur="emailTouched = true"
        />
        <p v-if="emailFieldError" id="auth-email-error" class="field-error">{{ emailFieldError }}</p>
      </div>

      <div v-if="mode !== 'forgot'" class="field">
        <label class="field-label" for="auth-password">密码</label>
        <input
          id="auth-password"
          v-model="password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          placeholder="至少 6 位"
        />
        <button v-if="mode === 'login'" class="forgot-link link-btn" type="button" @click="switchMode('forgot')">
          忘记密码？
        </button>
      </div>

      <div v-if="mode === 'register'" class="field">
        <label class="field-label" for="auth-confirm">确认密码</label>
        <input
          id="auth-confirm"
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          placeholder="再输入一次"
        />
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <button class="btn btn-primary btn-block" type="submit" :disabled="busy || !account.available">
        {{ actionText }}
      </button>
    </form>

    <p v-if="!(mode === 'forgot' && sent)" class="switch-hint">
      <template v-if="mode === 'forgot'">
        <button class="link-btn" type="button" @click="switchMode('login')">返回登录</button>
      </template>
      <template v-else-if="mode === 'login'">
        还没有账号？
        <button class="link-btn" type="button" @click="switchMode('register')">注册</button>
      </template>
      <template v-else>
        已经有账号？
        <button class="link-btn" type="button" @click="switchMode('login')">登录</button>
      </template>
    </p>

    <p v-if="!account.available" class="notice">
      当前环境未配置云端服务，登录不可用；你仍可以将简历保存在本浏览器并导出备份。
    </p>
  </div>
</template>

<style scoped>
.auth { display: flex; flex-direction: column; gap: 14px; }
.auth-head { display: flex; flex-direction: column; gap: 3px; }
.auth-head h3 { margin: 0; font-size: 19px; font-weight: 600; }
.auth-head .hint { margin: 0; }

.auth-form { display: flex; flex-direction: column; gap: 12px; }
.field { position: relative; display: flex; flex-direction: column; gap: 6px; }
.field-label { color: var(--muted); font-size: 12px; font-weight: 500; }
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
input[aria-invalid='true'] { border-color: var(--danger); }
input[aria-invalid='true']:focus { box-shadow: 0 0 0 3.5px rgba(255, 59, 48, 0.18); }
.field-error { margin: 0; color: var(--danger); font-size: 12.5px; line-height: 1.5; }
.form-error { margin: 0; color: var(--danger); font-size: 13px; line-height: 1.5; }

.forgot-link {
  position: absolute;
  top: -2px;
  right: 0;
  font-size: 12.5px;
}

.sent { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.sent-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(0, 113, 227, 0.1);
  color: var(--accent);
}
.sent-mark svg { width: 21px; height: 21px; }
.sent-title { margin: 2px 0 0; font-size: 16px; font-weight: 600; }
.sent .hint { margin: 0; }
.sent .hint b { color: var(--ink); font-weight: 550; word-break: break-all; }
.sent-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }

.switch-hint { margin: 0; text-align: center; color: var(--muted); font-size: 13px; }
.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}
.link-btn:hover { text-decoration: underline; }
.notice { margin: 0; }
</style>
