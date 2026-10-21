<script setup lang="ts">
import { computed, onDeactivated, onMounted, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import { authErrorMessage } from '../cloud/authErrors'
import { confirmDialog } from '../ui/confirm'
import { showToast } from '../ui/toast'
import {
  adminSearchUsers,
  adminSendPasswordReset,
  adminSetBan,
  adminUserDetail,
  clampPage,
  mapAdminError,
  pageCount,
} from './adminApi'
import { banState, formatDateTime, formatNumber, formatRelative, shortId } from './adminFormat'
import type { AdminSearchResult, AdminUserDetailData } from './adminTypes'
import AdminUserDetail from './AdminUserDetail.vue'

const props = defineProps<{ currentUserId: string; focusUserId?: string }>()
const emit = defineEmits<{ 'focus-consumed': [] }>()

const PAGE_SIZE = 20

const query = ref('')
const applied = ref('')
const page = ref(1)
const result = ref<AdminSearchResult | null>(null)
const loading = ref(true)
const error = ref('')

const selectedId = ref('')
const detail = ref<AdminUserDetailData | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const actionBusy = ref(false)

const totalPages = computed(() => pageCount(result.value?.total ?? 0, PAGE_SIZE))
const summary = computed(() => {
  if (!result.value) return loading.value ? '正在读取用户' : ''
  const scope = applied.value ? `，匹配「${applied.value}」` : ''
  return `共 ${formatNumber(result.value.total)} 位用户${scope}`
})

let listSeq = 0
let detailSeq = 0

async function load(): Promise<void> {
  const my = ++listSeq
  loading.value = true
  error.value = ''
  try {
    const data = await adminSearchUsers(applied.value, page.value, PAGE_SIZE)
    if (my !== listSeq) return
    result.value = data
    const max = pageCount(data.total, PAGE_SIZE)
    if (page.value > max) {
      page.value = max
      void load()
      return
    }
  } catch (e) {
    if (my !== listSeq) return
    result.value = null
    error.value = mapAdminError(e)
  } finally {
    if (my === listSeq) loading.value = false
  }
}

function search(): void {
  applied.value = query.value.trim()
  page.value = 1
  void load()
}

function clearSearch(): void {
  query.value = ''
  applied.value = ''
  page.value = 1
  void load()
}

function go(next: number): void {
  const safe = clampPage(next, result.value?.total ?? 0, PAGE_SIZE)
  if (safe === page.value) return
  page.value = safe
  void load()
}

async function openUser(id: string): Promise<void> {
  if (!id) return
  const my = ++detailSeq
  selectedId.value = id
  detailOpen.value = true
  detailLoading.value = true
  detailError.value = ''
  detail.value = null
  try {
    const data = await adminUserDetail(id)
    if (my !== detailSeq) return
    detail.value = data
  } catch (e) {
    if (my !== detailSeq) return
    detailError.value = mapAdminError(e)
  } finally {
    if (my === detailSeq) detailLoading.value = false
  }
}

async function refreshDetail(): Promise<void> {
  const id = selectedId.value
  if (!id) return
  const my = ++detailSeq
  try {
    const data = await adminUserDetail(id)
    if (my !== detailSeq) return
    detail.value = data
    detailError.value = ''
  } catch (e) {
    if (my !== detailSeq) return
    detailError.value = mapAdminError(e)
  }
}

function describeError(e: unknown): string {
  const message = mapAdminError(e)
  return message === '操作失败，请稍后重试' ? authErrorMessage(e) : message
}

async function onReset(): Promise<void> {
  const current = detail.value
  if (!current || actionBusy.value) return
  if (!current.user.email) {
    showToast('该账号没有邮箱，无法发送重置邮件', 'error')
    return
  }
  const ok = await confirmDialog({
    title: '发送重置密码邮件',
    message: `将向 ${current.user.email} 发送密码重置邮件。用户设置新密码后，其他设备上的登录会失效。`,
    confirmText: '发送邮件',
  })
  if (!ok) return
  actionBusy.value = true
  try {
    await adminSendPasswordReset({ id: current.user.id, email: current.user.email })
    showToast('重置密码邮件已发送', 'success')
  } catch (e) {
    showToast(describeError(e), 'error', 4200)
  } finally {
    actionBusy.value = false
  }
}

async function onSetBan(banned: boolean): Promise<void> {
  const current = detail.value
  if (!current || actionBusy.value) return
  const email = current.user.email || current.user.id
  const ok = await confirmDialog(
    banned
      ? {
          title: '禁用该账号登录',
          message: `禁用后 ${email} 将无法登录，已登录的会话会在短时间内失效。账号与简历数据不会被删除。`,
          confirmText: '禁用登录',
          danger: true,
        }
      : {
          title: '恢复该账号登录',
          message: `${email} 将可以重新登录，账号与简历数据不受影响。`,
          confirmText: '恢复登录',
        },
  )
  if (!ok) return
  actionBusy.value = true
  try {
    const res = await adminSetBan(current.user.id, banned)
    if (detail.value?.user.id === current.user.id) {
      detail.value.user.bannedUntil = res.bannedUntil
    }
    showToast(banned ? '已禁用该账号登录' : '已恢复该账号登录', 'success')
    await load()
  } catch (e) {
    showToast(describeError(e), 'error', 4200)
  } finally {
    actionBusy.value = false
  }
}

watch(
  () => props.focusUserId,
  (id) => {
    if (!id) return
    if (query.value || applied.value || page.value !== 1) {
      query.value = ''
      applied.value = ''
      page.value = 1
      void load()
    }
    void openUser(id)
    emit('focus-consumed')
  },
  { immediate: true },
)

watch(detailOpen, (open) => {
  if (open) return
  detailSeq++
  selectedId.value = ''
  detail.value = null
  detailError.value = ''
  detailLoading.value = false
})

onDeactivated(() => {
  detailOpen.value = false
})

onMounted(load)
</script>

<template>
  <section class="adm-users" :aria-busy="loading">
    <div class="adm-section-head">
      <div>
        <h2>用户与账号</h2>
        <p>{{ summary }}</p>
      </div>
      <button class="adm-ghost" type="button" :disabled="loading" @click="load">
        {{ loading ? '读取中…' : '刷新' }}
      </button>
    </div>

    <form class="adm-search" role="search" @submit.prevent="search">
      <input
        v-model="query"
        type="search"
        name="q"
        placeholder="搜索邮箱或用户 ID"
        aria-label="搜索邮箱或用户 ID"
        autocomplete="off"
        spellcheck="false"
      />
      <button class="btn btn-primary" type="submit" :disabled="loading">搜索</button>
      <button v-if="applied" class="btn btn-plain" type="button" @click="clearSearch">清除</button>
    </form>

    <div class="adm-table-wrap">
      <table v-if="result?.users.length" class="adm-table">
        <thead>
          <tr>
            <th>用户</th>
            <th class="col-resumes">简历</th>
            <th class="col-created">注册</th>
            <th class="col-signin">最近登录</th>
            <th>状态</th>
            <th><span class="sr-only">操作</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in result.users" :key="u.id">
            <td>
              <span class="adm-cell-email">{{ u.email || '无邮箱' }}</span>
              <span class="adm-cell-id">{{ shortId(u.id) }}</span>
            </td>
            <td class="col-resumes">
              {{ u.resumeCount }} 份
              <span v-if="u.lastResumeUpdate" class="adm-cell-sub">
                {{ formatRelative(u.lastResumeUpdate) }}更新
              </span>
            </td>
            <td class="col-created">{{ formatDateTime(u.createdAt) }}</td>
            <td class="col-signin">{{ u.lastSignInAt ? formatRelative(u.lastSignInAt) : '从未登录' }}</td>
            <td>
              <span class="adm-badge" :class="banState(u.bannedUntil).banned ? 'banned' : 'ok'">
                {{ banState(u.bannedUntil).label }}
              </span>
              <span v-if="u.isAdmin" class="adm-badge admin">管理员</span>
            </td>
            <td><button class="adm-link" type="button" @click="openUser(u.id)">查看</button></td>
          </tr>
        </tbody>
      </table>

      <p v-if="error" class="adm-table-state error" role="alert">
        {{ error }}
        <button type="button" @click="load">重试</button>
      </p>
      <p v-else-if="loading" class="adm-table-state">正在读取用户…</p>
      <p v-else-if="!result?.users.length" class="adm-table-state">
        {{ applied ? '没有找到匹配的用户' : '还没有用户' }}
      </p>
    </div>

    <div v-if="result && result.total > 0" class="adm-pager">
      <span>共 {{ formatNumber(result.total) }} 位 · 第 {{ page }} / {{ totalPages }} 页</span>
      <div>
        <button type="button" :disabled="loading || page <= 1" @click="go(page - 1)">上一页</button>
        <button type="button" :disabled="loading || page >= totalPages" @click="go(page + 1)">下一页</button>
      </div>
    </div>

    <Sheet v-model:open="detailOpen" title="用户详情">
      <div v-if="detailLoading" class="adm-boot">
        <span class="adm-spinner" aria-hidden="true" />
        <span>正在读取用户信息…</span>
      </div>
      <div v-else-if="detailError" class="adm-error-card" role="alert">
        <Icon name="alert" />
        <div>
          <strong>用户信息读取失败</strong>
          <p>{{ detailError }}</p>
        </div>
        <button class="btn" type="button" @click="openUser(selectedId)">重试</button>
      </div>
      <AdminUserDetail
        v-else-if="detail"
        :data="detail"
        :current-user-id="currentUserId"
        :busy="actionBusy"
        @refresh="refreshDetail"
        @reset="onReset"
        @set-ban="onSetBan"
      />
      <p v-else class="adm-empty">请选择用户</p>
    </Sheet>
  </section>
</template>
