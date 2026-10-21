<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import { banState, formatBytes, formatDateTime, formatRelative } from './adminFormat'
import type { AdminUserDetailData } from './adminTypes'

const props = defineProps<{
  data: AdminUserDetailData
  currentUserId: string
  busy?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  reset: []
  'set-ban': [banned: boolean]
}>()

const user = computed(() => props.data.user)
const state = computed(() => banState(user.value.bannedUntil, new Date()))
const isSelf = computed(() => user.value.id === props.currentUserId)
const canReset = computed(() => !isSelf.value && user.value.email !== '')
const canBan = computed(() => !isSelf.value && !user.value.isAdmin)
const resumeBytes = computed(() => props.data.resumes.reduce((sum, r) => sum + r.bytes, 0))
const storageBytes = computed(() => props.data.storage.reduce((sum, s) => sum + s.bytes, 0))
const initial = computed(() => user.value.email.slice(0, 1) || '?')

const BUCKET_LABELS: Record<string, string> = { 'resume-photos': '简历照片', avatars: '头像' }

function bucketLabel(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? bucket
}
</script>

<template>
  <div class="adm-detail" :aria-busy="busy">
    <header class="adm-detail-head">
      <span class="adm-avatar" aria-hidden="true">{{ initial }}</span>
      <div class="adm-detail-identity">
        <p class="adm-detail-email">{{ user.email || '无邮箱' }}</p>
        <p class="adm-detail-id">{{ user.id }}</p>
      </div>
      <button class="adm-link" type="button" :disabled="busy" @click="emit('refresh')">刷新</button>
    </header>

    <div class="adm-detail-badges">
      <span class="adm-badge" :class="state.banned ? 'banned' : 'ok'">{{ state.label }}</span>
      <span v-if="user.isAdmin" class="adm-badge admin">管理员</span>
      <span class="adm-badge" :class="{ ok: !!user.emailConfirmedAt }">
        {{ user.emailConfirmedAt ? '邮箱已验证' : '邮箱未验证' }}
      </span>
      <span v-if="isSelf" class="adm-badge">当前账号</span>
    </div>

    <section class="adm-detail-section first">
      <h3>账号信息 <span>仅元信息</span></h3>
      <dl class="adm-facts">
        <div>
          <dt>昵称</dt>
          <dd>{{ data.profile?.displayName || '—' }}</dd>
        </div>
        <div>
          <dt>注册时间</dt>
          <dd>{{ formatDateTime(user.createdAt) }}</dd>
        </div>
        <div>
          <dt>最近登录</dt>
          <dd>{{ user.lastSignInAt ? formatRelative(user.lastSignInAt) : '从未登录' }}</dd>
        </div>
        <div>
          <dt>邮箱验证</dt>
          <dd>{{ user.emailConfirmedAt ? formatDateTime(user.emailConfirmedAt) : '未验证' }}</dd>
        </div>
      </dl>
    </section>

    <section class="adm-detail-section">
      <h3>云端简历 <span>{{ data.resumes.length }} 份 · {{ formatBytes(resumeBytes) }}</span></h3>
      <ul v-if="data.resumes.length" class="adm-meta-list">
        <li v-for="r in data.resumes" :key="r.id" class="adm-meta-row">
          <span class="adm-meta-name" :title="r.name">{{ r.name }}</span>
          <span class="adm-meta-sub">{{ formatRelative(r.updatedAt) }} · {{ formatBytes(r.bytes) }}</span>
        </li>
      </ul>
      <p v-else class="adm-note">还没有云端简历。</p>
    </section>

    <section class="adm-detail-section">
      <h3>存储占用 <span>{{ formatBytes(storageBytes) }}</span></h3>
      <ul v-if="data.storage.length" class="adm-meta-list">
        <li v-for="s in data.storage" :key="s.bucket" class="adm-meta-row">
          <span class="adm-meta-name">{{ bucketLabel(s.bucket) }}</span>
          <span class="adm-meta-sub">{{ s.objects }} 个文件 · {{ formatBytes(s.bytes) }}</span>
        </li>
      </ul>
      <p v-else class="adm-note">没有上传过头像或照片。</p>
    </section>

    <p class="adm-note">管理台只读取账号、简历与存储的元信息，不展示简历正文或文件内容。</p>

    <div class="adm-detail-actions">
      <button class="btn" type="button" :disabled="busy || !canReset" @click="emit('reset')">
        <Icon name="mail" />
        发送重置密码邮件
      </button>
      <button
        v-if="state.banned"
        class="btn"
        type="button"
        :disabled="busy || !canBan"
        @click="emit('set-ban', false)"
      >
        <Icon name="check" />
        恢复登录
      </button>
      <button
        v-else
        class="btn btn-danger"
        type="button"
        :disabled="busy || !canBan"
        @click="emit('set-ban', true)"
      >
        <Icon name="lock" />
        禁用登录
      </button>
      <p class="adm-action-hint">
        <template v-if="isSelf">这是当前登录账号，不能在管理台重置或禁用自己。</template>
        <template v-else-if="user.isAdmin">管理员账号不支持在管理台禁用登录。</template>
        <template v-else>禁用只阻止登录，不删除账号或简历；每次操作都会写入审计日志。</template>
      </p>
    </div>
  </div>
</template>
