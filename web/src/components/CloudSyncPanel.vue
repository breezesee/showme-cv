<script setup lang="ts">
import { ref } from 'vue'
import { cloud, signIn, signUp, signOut, authErrorMessage } from '../cloud/session'

const expanded = ref(false)
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

const pad = (n: number) => String(n).padStart(2, '0')
const statusText = () => {
  if (cloud.status === 'syncing') return '同步中…'
  if (cloud.status === 'synced' && cloud.syncedAt) {
    const d = new Date(cloud.syncedAt)
    return `已同步 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  if (cloud.status === 'offline') return '离线'
  if (cloud.status === 'error') return '同步失败'
  return '已同步'
}

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
    expanded.value = false
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

function toggleMode(): void {
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
  <section v-if="cloud.available" class="cloud-bar">
    <!-- 已登录：一行状态 -->
    <template v-if="cloud.ready">
      <div class="bar-row">
        <span class="dot" :class="cloud.status" />
        <span class="bar-email">{{ cloud.email }}</span>
        <span class="bar-status" :class="cloud.status">{{ statusText() }}</span>
        <button class="bar-action" type="button" :disabled="busy" @click="doSignOut">退出</button>
      </div>
      <p v-if="cloud.message" class="bar-msg">{{ cloud.message }}</p>
    </template>

    <!-- 未登录：折叠 / 展开 -->
    <template v-else>
      <button v-if="!expanded" class="bar-row bar-prompt" type="button" @click="expanded = true">
        <span class="prompt-text">登录后可跨设备同步简历</span>
        <span class="prompt-link">登录</span>
      </button>

      <div v-else class="bar-form">
        <form @submit.prevent="submit">
          <input v-model="email" type="email" placeholder="邮箱" autocomplete="email" required />
          <input v-model="password" type="password" :placeholder="mode === 'register' ? '设置密码（至少 6 位）' : '密码'" autocomplete="current-password" required />
          <input v-if="mode === 'register'" v-model="confirm" type="password" placeholder="确认密码" autocomplete="new-password" required />
          <p v-if="error" class="form-error">{{ error }}</p>
          <div class="form-actions">
            <button class="submit-btn" type="submit" :disabled="busy">
              {{ busy ? '请稍候…' : mode === 'login' ? '登录' : '注册' }}
            </button>
            <button class="cancel-btn" type="button" @click="expanded = false; error = ''">取消</button>
            <button class="mode-btn" type="button" @click="toggleMode">
              {{ mode === 'login' ? '没有账号？注册' : '已有账号？登录' }}
            </button>
          </div>
        </form>
      </div>
    </template>
  </section>
</template>

<style scoped>
.cloud-bar {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}

.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--disabled);
}
.dot.synced { background: var(--success, #34c759); }
.dot.syncing { background: var(--accent); animation: pulse 1.2s ease-in-out infinite; }
.dot.offline { background: var(--warning); }
.dot.error { background: var(--danger, #ff3b30); }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.bar-email {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--ink);
}
.bar-status {
  flex: none;
  font-size: 12px;
  color: var(--muted);
}
.bar-status.error { color: var(--danger, #ff3b30); }
.bar-status.offline { color: var(--warning); }

.bar-action {
  flex: none;
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}
.bar-action:hover { color: var(--ink); }

.bar-msg {
  margin: 4px 0 0 15px;
  font-size: 12px;
  color: var(--warning);
}

/* 未登录折叠态 */
.bar-prompt {
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}
.prompt-text {
  flex: 1;
  font-size: 13px;
  color: var(--muted);
}
.prompt-link {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
}
.bar-prompt:hover .prompt-link { text-decoration: underline; }

/* 展开的登录表单 */
.bar-form form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bar-form input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.bar-form input:focus { border-color: var(--accent); }
.form-error { margin: 0; font-size: 12px; color: var(--warning); }
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 2px;
}
.submit-btn {
  height: 34px;
  padding: 0 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.submit-btn:disabled { opacity: 0.5; cursor: default; }
.cancel-btn, .mode-btn {
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}
.cancel-btn:hover { color: var(--ink); }
.mode-btn { color: var(--accent); margin-left: auto; }
.mode-btn:hover { text-decoration: underline; }
</style>
