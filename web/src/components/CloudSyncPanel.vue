<script setup lang="ts">
import { ref } from 'vue'
import { cloud, signIn, signUp, signOut, authErrorMessage } from '../cloud/session'

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

const pad = (n: number) => String(n).padStart(2, '0')

function validate(): string | null {
  if (!email.value.trim()) return '请输入邮箱'
  if (password.value.length < 6) return '密码至少 6 位'
  if (mode.value === 'register' && password.value !== confirm.value) return '两次密码不一致'
  return null
}

async function submit(): Promise<void> {
  const msg = validate()
  if (msg) { error.value = msg; return }
  busy.value = true
  error.value = ''
  try {
    if (mode.value === 'login') await signIn(email.value.trim(), password.value)
    else await signUp(email.value.trim(), password.value)
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

function toggle(): void {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}

async function doSignOut(): Promise<void> {
  busy.value = true
  await signOut()
  email.value = ''
  password.value = ''
  confirm.value = ''
  error.value = ''
  busy.value = false
}
</script>

<template>
  <section v-if="cloud.available" class="card block cloud-panel">
    <header class="zone-head">
      <h3>云同步</h3>
      <p class="hint">登录后简历自动同步到云端，换设备也不丢。</p>
    </header>

    <!-- 已登录 -->
    <template v-if="cloud.ready">
      <div class="info-row">
        <span class="email">{{ cloud.email }}</span>
        <span class="sync-badge" :class="cloud.status">
          <template v-if="cloud.status === 'syncing'">同步中…</template>
          <template v-else-if="cloud.status === 'synced' && cloud.syncedAt">
            已同步 {{ pad(new Date(cloud.syncedAt).getHours()) }}:{{ pad(new Date(cloud.syncedAt).getMinutes()) }}
          </template>
          <template v-else-if="cloud.status === 'offline'">离线…</template>
          <template v-else-if="cloud.status === 'error'">失败</template>
          <template v-else>已同步</template>
        </span>
      </div>
      <p v-if="cloud.message" class="notice">{{ cloud.message }}</p>
      <div class="actions">
        <button class="btn" type="button" :disabled="busy" @click="doSignOut">退出登录</button>
      </div>
    </template>

    <!-- 未登录 -->
    <template v-else>
      <form class="auth-form" @submit.prevent="submit">
        <input v-model="email" type="email" placeholder="邮箱" autocomplete="email" required />
        <input v-model="password" type="password" placeholder="密码（至少 6 位）" autocomplete="current-password" required />
        <input v-if="mode === 'register'" v-model="confirm" type="password" placeholder="确认密码" autocomplete="new-password" required />
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="btn btn-primary" type="submit" :disabled="busy">
          {{ busy ? '请稍候…' : mode === 'login' ? '登录' : '注册' }}
        </button>
      </form>
      <p class="switch-hint">
        {{ mode === 'login' ? '没有账号？' : '已有账号？' }}
        <button class="link-btn" type="button" @click="toggle">{{ mode === 'login' ? '注册' : '登录' }}</button>
      </p>
    </template>
  </section>
</template>

<style scoped>
.cloud-panel { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.zone-head { display: flex; flex-direction: column; gap: 2px; }
.zone-head h3 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }
.zone-head .hint { margin: 0; color: var(--muted); font-size: 13px; }

.info-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.email { font-size: 14px; color: var(--ink); word-break: break-all; }
.sync-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--fill);
  color: var(--muted);
}
.sync-badge.syncing { color: var(--accent); }
.sync-badge.synced { color: var(--success, #34c759); }
.sync-badge.offline { color: var(--warning); }
.sync-badge.error { background: var(--warning-bg); color: var(--warning); }

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.auth-form input {
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm, 8px);
  background: var(--bg);
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}
.auth-form input:focus { border-color: var(--accent); }
.form-error { margin: 0; color: var(--warning); font-size: 13px; }

.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.switch-hint { margin: 0; font-size: 13px; color: var(--muted); }
.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}
.link-btn:hover { text-decoration: underline; }
</style>
