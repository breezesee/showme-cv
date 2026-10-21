<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { getClient } from '../cloud/client'
import { formatBuildTime, currentBuild } from '../version'
import { adminOverview, adminRecentAudit, fetchRelayStats, mapAdminError } from './adminApi'
import { actionLabel, auditTargetLabel, formatDateTime, formatNumber, formatRelative } from './adminFormat'
import type { AdminAuditEntry, AdminOverviewData, RelayStats } from './adminTypes'
import DailyBars from './DailyBars.vue'

const emit = defineEmits<{ 'open-user': [id: string] }>()

const data = ref<AdminOverviewData | null>(null)
const audit = ref<AdminAuditEntry[]>([])
const relay = ref<RelayStats | null>(null)
const relayChecked = ref(false)
const auditFailed = ref(false)
const loading = ref(true)
const error = ref('')
const updatedAt = ref<Date | null>(null)
const build = currentBuild()

const relayCount = computed(() => (relay.value ? formatNumber(relay.value.active) : '—'))

async function loadRelay(): Promise<RelayStats | null> {
  try {
    const client = await getClient()
    const { data: { session } } = await client.auth.getSession()
    return await fetchRelayStats(session?.access_token ?? '')
  } catch {
    return null
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  const [overviewResult, auditResult, relayResult] = await Promise.allSettled([
    adminOverview(),
    adminRecentAudit(8),
    loadRelay(),
  ])

  if (overviewResult.status === 'fulfilled') {
    data.value = overviewResult.value
    updatedAt.value = new Date()
  } else {
    error.value = mapAdminError(overviewResult.reason)
  }

  if (auditResult.status === 'fulfilled') {
    audit.value = auditResult.value
    auditFailed.value = false
  } else {
    audit.value = []
    auditFailed.value = true
  }

  relay.value = relayResult.status === 'fulfilled' ? relayResult.value : null
  relayChecked.value = true
  loading.value = false
}

onActivated(load)
</script>

<template>
  <section class="adm-overview" :aria-busy="loading">
    <div class="adm-section-head">
      <div>
        <h2>今天的情况</h2>
        <p v-if="updatedAt">更新于 {{ formatDateTime(updatedAt) }} · 北京时间</p>
        <p v-else>正在读取运营数据</p>
      </div>
      <button class="adm-ghost" type="button" :disabled="loading" @click="load">
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <div v-if="error" class="adm-error-card" role="alert">
      <Icon name="alert" />
      <div>
        <strong>数据读取失败</strong>
        <p>{{ error }}</p>
      </div>
      <button class="btn" type="button" @click="load">重试</button>
    </div>

    <template v-if="data">
      <div class="adm-kpis">
        <article class="adm-kpi" data-testid="admin-kpi-users">
          <p class="adm-kpi-label">用户总数</p>
          <p class="adm-kpi-value">{{ formatNumber(data.users.total) }}</p>
          <p class="adm-kpi-sub">
            <span>近 7 天新增 <b>{{ formatNumber(data.users.new7d) }}</b></span>
            <span>近 7 天活跃 <b>{{ formatNumber(data.users.active7d) }}</b></span>
          </p>
        </article>

        <article class="adm-kpi" data-testid="admin-kpi-resumes">
          <p class="adm-kpi-label">云端简历</p>
          <p class="adm-kpi-value">{{ formatNumber(data.resumes.total) }}</p>
          <p class="adm-kpi-sub">
            <span>近 7 天新增 <b>{{ formatNumber(data.resumes.new7d) }}</b></span>
            <span>近 7 天有更新 <b>{{ formatNumber(data.resumes.updated7d) }}</b></span>
          </p>
        </article>

        <article class="adm-kpi" data-testid="admin-kpi-relay">
          <p class="adm-kpi-label">有效分享链接</p>
          <p class="adm-kpi-value" :class="{ muted: !relay }">{{ relayCount }}</p>
          <p class="adm-kpi-sub">
            <template v-if="relay">
              <span>7 天内到期 <b>{{ formatNumber(relay.expiring7d) }}</b></span>
              <span>更新于 {{ formatRelative(relay.checkedAt) }}</span>
            </template>
            <template v-else>{{ relayChecked ? '暂时无法获取分享链接统计，稍后刷新' : '统计中…' }}</template>
          </p>
        </article>
      </div>

      <div class="adm-charts">
        <DailyBars title="新增用户" :points="data.daily.users" unit="位用户" tone="blue" />
        <DailyBars title="新增简历" :points="data.daily.resumes" unit="份简历" tone="gold" />
      </div>

      <div class="adm-split">
        <section class="adm-card">
          <header class="adm-card-head">
            <h3>最近注册</h3>
            <span class="adm-card-note">按注册时间 · 点击查看</span>
          </header>
          <ul v-if="data.recentUsers.length" class="adm-recent-list">
            <li v-for="u in data.recentUsers" :key="u.id">
              <button type="button" @click="emit('open-user', u.id)">
                <span class="adm-avatar" aria-hidden="true">{{ u.email.slice(0, 1) || '?' }}</span>
                <span class="adm-recent-main">
                  <span class="adm-recent-email">{{ u.email || '无邮箱' }}</span>
                  <span class="adm-recent-sub">
                    {{ formatRelative(u.createdAt) }} 注册 · {{ u.resumeCount }} 份简历
                  </span>
                </span>
                <Icon name="chevron" />
              </button>
            </li>
          </ul>
          <p v-else class="adm-empty">还没有用户</p>
        </section>

        <div class="adm-stack">
          <section class="adm-card">
            <header class="adm-card-head">
              <h3>分享链接</h3>
              <span class="adm-card-note">只读</span>
            </header>
            <dl class="adm-facts">
              <div>
                <dt>分享服务</dt>
                <dd :class="relay ? 'ok' : 'warn'">{{ relay ? '正常' : '未知' }}</dd>
              </div>
              <div>
                <dt>有效链接</dt>
                <dd>{{ relay ? formatNumber(relay.active) : '—' }}</dd>
              </div>
            </dl>
            <p class="adm-card-foot">这里只显示通过 ShowMe 生成的分享链接；直接复制的长链接无法在这里管理。</p>
            <details class="adm-sys">
              <summary>系统信息</summary>
              <dl class="adm-facts">
                <div>
                  <dt>版本</dt>
                  <dd>v{{ build.version }}</dd>
                </div>
                <div>
                  <dt>构建时间</dt>
                  <dd>{{ formatBuildTime(build.buildTime) }}</dd>
                </div>
              </dl>
            </details>
          </section>

          <section class="adm-card">
            <header class="adm-card-head">
              <h3>最近操作</h3>
              <span class="adm-card-note">审计日志</span>
            </header>
            <ul v-if="audit.length" class="adm-audit">
              <li v-for="a in audit" :key="a.id" data-testid="admin-audit-row">
                <span class="adm-audit-action">{{ actionLabel(a.action) }}</span>
                <span class="adm-audit-who">{{ a.actorEmail || '系统' }}</span>
                <time :title="formatDateTime(a.createdAt)">{{ formatRelative(a.createdAt) }}</time>
                <span class="adm-audit-target">→ {{ auditTargetLabel(a) }}</span>
              </li>
            </ul>
            <p v-else class="adm-empty">{{ auditFailed ? '审计记录暂时无法读取' : '还没有管理操作' }}</p>
          </section>
        </div>
      </div>
    </template>

    <div v-else-if="loading" class="adm-skeleton" aria-hidden="true">
      <div class="adm-sk" />
      <div class="adm-sk" />
      <div class="adm-sk small" />
    </div>
  </section>
</template>
