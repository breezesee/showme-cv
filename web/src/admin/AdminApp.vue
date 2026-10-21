<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLogin from './AdminLogin.vue'
import AdminOverview from './AdminOverview.vue'
import AdminUsers from './AdminUsers.vue'
import ConfirmHost from '../components/ConfirmHost.vue'
import Icon from '../components/Icon.vue'
import ToastHost from '../components/ToastHost.vue'
import { signInAccount, signOutAccount } from '../cloud/account'
import { authErrorMessage } from '../cloud/authErrors'
import { cloudConfigured, getClient } from '../cloud/client'
import { readAdminIdentity, type AdminIdentity } from './adminAuth'
import { formatDate } from './adminFormat'

type Phase = 'boot' | 'signed-out' | 'denied' | 'error' | 'ready'
type Tab = 'overview' | 'users'

const phase = ref<Phase>('boot')
const busy = ref(false)
const loginError = ref('')
const bootError = ref('')
const deniedEmail = ref('')
const identity = ref<AdminIdentity | null>(null)
const tab = ref<Tab>('overview')
const focusUserId = ref('')
const today = formatDate(new Date())

/** 管理台挂在 /admin，返回编辑器时要回到站点根目录；子路径部署同样适用 */
function editorHome(): string {
  const path = location.pathname.replace(/\/+$/, '')
  if (path.endsWith('/admin')) return `${path.slice(0, -'/admin'.length)}/`
  return new URL('./', location.href).href
}
const homeHref = editorHome()

async function boot(): Promise<void> {
  phase.value = 'boot'
  bootError.value = ''
  identity.value = null
  if (!cloudConfigured()) {
    bootError.value = '管理台暂时不可用，请稍后再试或联系技术同事。'
    phase.value = 'error'
    return
  }
  try {
    const client = await getClient()
    const { data: { session } } = await client.auth.getSession()
    if (!session) {
      phase.value = 'signed-out'
      return
    }
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) {
      phase.value = 'signed-out'
      return
    }
    const id = readAdminIdentity(user)
    if (!id || !id.isAdmin) {
      deniedEmail.value = id?.email || user.email || ''
      phase.value = 'denied'
      return
    }
    identity.value = id
    phase.value = 'ready'
  } catch {
    bootError.value = '无法连接账号服务，请检查网络后重试。'
    phase.value = 'error'
  }
}

async function login(email: string, password: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  loginError.value = ''
  try {
    await signInAccount(email, password)
    const client = await getClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) {
      loginError.value = '登录状态异常，请重试'
      return
    }
    const id = readAdminIdentity(user)
    if (!id || !id.isAdmin) {
      await signOutAccount()
      deniedEmail.value = id?.email || user.email || email
      phase.value = 'denied'
      return
    }
    identity.value = id
    phase.value = 'ready'
  } catch (e) {
    loginError.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function leave(): Promise<void> {
  busy.value = true
  await signOutAccount()
  busy.value = false
  identity.value = null
  deniedEmail.value = ''
  loginError.value = ''
  tab.value = 'overview'
  focusUserId.value = ''
  phase.value = 'signed-out'
}

function switchTab(next: Tab): void {
  tab.value = next
  if (next === 'overview') focusUserId.value = ''
}

function openUser(id: string): void {
  focusUserId.value = id
  tab.value = 'users'
}

onMounted(boot)
</script>

<template>
  <div v-if="phase === 'boot'" class="adm-gate-page">
    <div class="adm-gate-card">
      <div class="adm-brandline">
        <span class="adm-brand-word">ShowMe<span class="adm-brand-dot">.</span></span>
        <span class="adm-brand-tag">管理台</span>
      </div>
      <div class="adm-boot" role="status">
        <span class="adm-spinner" aria-hidden="true" />
        <span>正在验证管理权限…</span>
      </div>
    </div>
  </div>

  <div v-else-if="phase === 'error'" class="adm-gate-page">
    <div class="adm-gate-card">
      <div class="adm-brandline">
        <span class="adm-brand-word">ShowMe<span class="adm-brand-dot">.</span></span>
        <span class="adm-brand-tag">管理台</span>
      </div>
      <h1>无法进入管理台</h1>
      <p class="adm-gate-text">{{ bootError }}</p>
      <div class="adm-gate-actions">
        <button class="btn btn-primary btn-block" type="button" @click="boot">重试</button>
        <a class="btn btn-block" :href="homeHref">返回简历编辑器</a>
      </div>
    </div>
  </div>

  <div v-else-if="phase === 'denied'" class="adm-gate-page">
    <div class="adm-gate-card">
      <div class="adm-brandline">
        <span class="adm-brand-word">ShowMe<span class="adm-brand-dot">.</span></span>
        <span class="adm-brand-tag">管理台</span>
      </div>
      <h1>该账号没有管理权限</h1>
      <p class="adm-gate-text">
        当前登录：{{ deniedEmail || '未知账号' }}。管理台仅向已授权的管理员账号开放。
      </p>
      <div class="adm-gate-actions">
        <button class="btn btn-primary btn-block" type="button" :disabled="busy" @click="leave">
          退出并更换账号
        </button>
        <a class="btn btn-block" :href="homeHref">返回简历编辑器</a>
      </div>
    </div>
  </div>

  <AdminLogin
    v-else-if="phase === 'signed-out'"
    :busy="busy"
    :error="loginError"
    :base="homeHref"
    @submit="login"
  />

  <template v-else>
    <div class="adm-shell">
      <aside class="adm-side">
        <a class="adm-brand" :href="homeHref">
          ShowMe<span class="adm-dot">.</span>
          <span class="adm-brand-tag">管理台</span>
        </a>

        <nav class="adm-nav" aria-label="管理台导航">
          <button
            type="button"
            aria-label="运营总览"
            :class="{ active: tab === 'overview' }"
            :aria-current="tab === 'overview' ? 'page' : undefined"
            @click="switchTab('overview')"
          >
            <Icon name="layers" />
            <span>运营总览</span>
          </button>
          <button
            type="button"
            aria-label="用户与账号"
            :class="{ active: tab === 'users' }"
            :aria-current="tab === 'users' ? 'page' : undefined"
            @click="switchTab('users')"
          >
            <Icon name="user" />
            <span>用户与账号</span>
          </button>
        </nav>

        <div class="adm-side-foot">
          <p class="adm-side-label">当前管理员</p>
          <p class="adm-side-email" :title="identity?.email">{{ identity?.email }}</p>
          <button class="adm-side-action" type="button" :disabled="busy" @click="leave">退出管理台</button>
        </div>
      </aside>

      <main class="adm-main">
        <header class="adm-top">
          <div>
            <p class="adm-eyebrow">ShowMe Admin</p>
            <h1>{{ tab === 'overview' ? '运营总览' : '用户与账号' }}</h1>
          </div>
          <div class="adm-top-meta">
            <span class="adm-today">{{ today }}</span>
            <a class="adm-back" :href="homeHref">返回简历编辑器</a>
          </div>
        </header>

        <KeepAlive>
          <AdminOverview v-if="tab === 'overview'" @open-user="openUser" />
          <AdminUsers
            v-else
            :current-user-id="identity?.id ?? ''"
            :focus-user-id="focusUserId"
            @focus-consumed="focusUserId = ''"
          />
        </KeepAlive>
      </main>
    </div>
  </template>

  <ToastHost />
  <ConfirmHost />
</template>
