<script setup lang="ts">
import { computed, ref } from 'vue'
import { authErrorMessage } from '../cloud/authErrors'
import { login, register, useResume } from '../store/useResume'

/** 登录 / 注册表单：桌面个人中心与手机「我的」页共用 */
const { account } = useResume()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

const actionText = computed(() => {
  if (busy.value) return '请稍候…'
  return mode.value === 'login' ? '登录' : '创建账号'
})

function validate(): string | null {
  if (!account.available) return '云端服务未配置，暂时无法登录'
  if (!email.value.trim()) return '请输入邮箱'
  if (password.value.length < 6) return '密码至少 6 位'
  if (mode.value === 'register' && password.value !== confirm.value) return '两次密码不一致'
  return null
}

async function submit(): Promise<void> {
  const message = validate()
  if (message) {
    error.value = message
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (mode.value === 'login') await login(email.value.trim(), password.value)
    else await register(email.value.trim(), password.value)
    password.value = ''
    confirm.value = ''
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

function toggle(): void {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
  confirm.value = ''
}
</script>

<template>
  <div class="auth">
    <header class="auth-head">
      <h3>{{ mode === 'login' ? '登录账号' : '创建账号' }}</h3>
      <p class="hint">
        {{ mode === 'login' ? '登录后打开你的云端简历库。' : '注册后即可把简历保存到云端，换设备不丢。' }}
      </p>
    </header>

    <form class="auth-form" @submit.prevent="submit">
      <label class="field">
        <span class="field-label">邮箱</span>
        <input
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
          required
        />
      </label>

      <label class="field">
        <span class="field-label">密码</span>
        <input
          v-model="password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          placeholder="至少 6 位"
          required
        />
      </label>

      <label v-if="mode === 'register'" class="field">
        <span class="field-label">确认密码</span>
        <input
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          placeholder="再输入一次"
          required
        />
      </label>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <button class="btn btn-primary btn-block" type="submit" :disabled="busy || !account.available">
        {{ actionText }}
      </button>
    </form>

    <p class="switch-hint">
      {{ mode === 'login' ? '还没有账号？' : '已经有账号？' }}
      <button class="link-btn" type="button" @click="toggle">
        {{ mode === 'login' ? '注册' : '登录' }}
      </button>
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
.field { display: flex; flex-direction: column; gap: 6px; }
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
.form-error { margin: 0; color: var(--danger); font-size: 13px; line-height: 1.5; }

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
