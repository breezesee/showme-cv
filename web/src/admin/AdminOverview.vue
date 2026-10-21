<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { getClient } from '../cloud/client'
import { formatBuildTime, currentBuild } from '../version'
import { adminOverview, adminRecentAudit, fetchRelayStats, mapAdminError } from './adminApi'
import { actionLabel, auditTargetLabel, banState, formatDateTime, formatNumber, formatRelative } from './adminFormat'
import type {
  AdminAuditEntry,
  AdminOverviewData,
  AdminUserFilter,
  AdminUserSummary,
  DailyPoint,
  RelayStats,
} from './adminTypes'
import DailyBars from './DailyBars.vue'

const emit = defineEmits<{ 'open-user': [id: string]; 'open-users': [filter: AdminUserFilter] }>()

const ATTENTION: {
  filter: Exclude<AdminUserFilter, 'all'>
  label: string
  hint: string
  key: keyof AdminOverviewData['attention']
}[] = [
  { filter: 'banned', label: '禁用账号', hint: '确认是否需要恢复登录', key: 'banned' },
  { filter: 'no_resume7d', label: '7 天未建简历', hint: '可引导完成第一份简历', key: 'noResume7d' },
  { filter: 'inactive7d', label: '7 天未登录', hint: '关注流失风险', key: 'inactive7d' },
]

interface WeekTrend {
  current: number
  previous: number
}

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
const attentionTotal = computed(() => {
  if (!data.value) return 0
  const { banned, noResume7d, inactive7d } = data.value.attention
  return banned + noResume7d + inactive7d
})
const activeRate = computed(() => {
  if (!data.value || data.value.users.total === 0) return 0
  return Math.round((data.value.users.active7d / data.value.users.total) * 100)
})
const adoptionRate = computed(() => {
  if (!data.value || data.value.users.total === 0) return 0
  return Math.round((data.value.resumes.usersWithResume / data.value.users.total) * 100)
})

const week = computed(() => {
  const empty = { current: 0, previous: 0 }
  if (!data.value) return { users: empty, resumes: empty }
  return {
    users: weekTrend(data.value.daily.users, data.value.users.new7d),
    resumes: weekTrend(data.value.daily.resumes, data.value.resumes.new7d),
  }
})

function weekTrend(points: DailyPoint[], fallback: number): WeekTrend {
  if (points.length < 14) return { current: fallback, previous: 0 }
  return {
    current: fallback,
    previous: points.slice(-14, -7).reduce((sum, point) => sum + point.count, 0),
  }
}

function deltaLabel(trend: WeekTrend): string {
  if (trend.current === trend.previous) return '与前 7 天持平'
  const diff = trend.current - trend.previous
  return `较前 7 天 ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`
}

function deltaTone(trend: WeekTrend): string {
  if (trend.current === trend.previous) return 'flat'
  return trend.current > trend.previous ? 'up' : 'down'
}

type TagTone = 'banned' | 'admin' | 'empty'

function statusTags(user: AdminUserSummary): { label: string; tone: TagTone }[] {
  const tags: { label: string; tone: TagTone }[] = []
  if (banState(user.bannedUntil).banned) tags.push({ label: '已禁用', tone: 'banned' })
  if (user.isAdmin) tags.push({ label: '管理员', tone: 'admin' })
  if (user.resumeCount === 0) tags.push({ label: '未建简历', tone: 'empty' })
  if (!user.lastSignInAt) tags.push({ label: '未登录', tone: 'empty' })
  return tags.slice(0, 2)
}

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
      <!-- 先给可执行的事，再看报表 -->
      <section class="adm-card adm-attention" data-testid="admin-attention">
        <header class="adm-card-head">
          <h3>需要关注</h3>
          <span class="adm-card-note">
            {{ attentionTotal ? `${formatNumber(attentionTotal)} 个账号待处理` : '暂无待处理事项' }}
          </span>
        </header>
        <div class="adm-attention-grid">
          <button
            v-for="item in ATTENTION"
            :key="item.filter"
            class="adm-attention-item"
            :class="{ empty: data.attention[item.key] === 0 }"
            type="button"
            @click="emit('open-users', item.filter)"
          >
            <span class="adm-attention-count">{{ formatNumber(data.attention[item.key]) }}</span>
            <span class="adm-attention-main">
              <b>{{ item.label }}</b>
              <small>{{ item.hint }}</small>
            </span>
            <Icon name="chevron" />
          </button>
        </div>
      </section>

      <div class="adm-kpis">
        <article class="adm-kpi" data-testid="admin-kpi-users">
          <p class="adm-kpi-label">用户总数</p>
          <p class="adm-kpi-value">{{ formatNumber(data.users.total) }}</p>
          <p class="adm-kpi-sub">
            <span>近 7 天新增 <b>{{ formatNumber(week.users.current) }}</b></span>
            <span class="adm-kpi-trend" :class="deltaTone(week.users)">{{ deltaLabel(week.users) }}</span>
          </p>
          <p class="adm-kpi-meta">近 7 天活跃率 <b>{{ activeRate }}%</b>（{{ formatNumber(data.users.active7d) }} 人）</p>
        </article>

        <article class="adm-kpi" data-testid="admin-kpi-resumes">
          <p class="adm-kpi-label">云端简历</p>
          <p class="adm-kpi-value">{{ formatNumber(data.resumes.total) }}</p>
          <p class="adm-kpi-sub">
            <span>近 7 天新增 <b>{{ formatNumber(week.resumes.current) }}</b></span>
            <span class="adm-kpi-trend" :class="deltaTone(week.resumes)">{{ deltaLabel(week.resumes) }}</span>
          </p>
          <p class="adm-kpi-meta">
            {{ formatNumber(data.resumes.usersWithResume) }} 位用户已建简历（{{ adoptionRate }}%）
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
            <template v-else>{{ relayChecked ? '暂时无法获取分享链接统计' : '统计中…' }}</template>
          </p>
          <p class="adm-kpi-meta">
            {{ relay ? '分享服务正常' : relayChecked ? '分享服务状态未知，稍后刷新' : '正在检查分享服务' }}
          </p>
        </article>
      </div>

      <div class="adm-charts">
        <DailyBars title="新增用户" :points="data.daily.users" unit="位用户" tone="blue" />
        <DailyBars title="新增简历" :points="data.daily.resumes" unit="份简历" tone="gold" />
      </div>

      <div class="adm-lists">
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
                <span v-if="statusTags(u).length" class="adm-tags">
                  <span v-for="tag in statusTags(u)" :key="tag.label" class="adm-tag" :class="tag.tone">{{ tag.label }}</span>
                </span>
                <Icon name="chevron" />
              </button>
            </li>
          </ul>
          <p v-else class="adm-empty">还没有用户</p>
        </section>

        <section class="adm-card">
          <header class="adm-card-head">
            <h3>最近活跃</h3>
            <span class="adm-card-note">按最近登录 · 不含管理员</span>
          </header>
          <ul v-if="data.activeUsers.length" class="adm-recent-list">
            <li v-for="u in data.activeUsers" :key="u.id">
              <button type="button" @click="emit('open-user', u.id)">
                <span class="adm-avatar active" aria-hidden="true">{{ u.email.slice(0, 1) || '?' }}</span>
                <span class="adm-recent-main">
                  <span class="adm-recent-email">{{ u.email || '无邮箱' }}</span>
                  <span class="adm-recent-sub">
                    {{ formatRelative(u.lastSignInAt) }} 活跃 · {{ u.resumeCount }} 份简历
                  </span>
                </span>
                <span v-if="statusTags(u).length" class="adm-tags">
                  <span v-for="tag in statusTags(u)" :key="tag.label" class="adm-tag" :class="tag.tone">{{ tag.label }}</span>
                </span>
                <Icon name="chevron" />
              </button>
            </li>
          </ul>
          <p v-else class="adm-empty">近 7 天还没有用户登录</p>
        </section>
      </div>

      <section class="adm-card adm-audit-card">
        <header class="adm-card-head">
          <h3>最近操作</h3>
          <span class="adm-card-note">管理动作审计日志</span>
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

      <details class="adm-sys adm-page-foot">
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
          <div>
            <dt>分享服务</dt>
            <dd :class="relay ? 'ok' : 'warn'">{{ relay ? '正常' : relayChecked ? '未知' : '检查中' }}</dd>
          </div>
        </dl>
        <p class="adm-note">有效分享链接只统计通过 ShowMe 生成的短链接；直接复制的长链接无法在这里管理。</p>
      </details>
    </template>

    <div v-else-if="loading" class="adm-skeleton" aria-hidden="true">
      <div class="adm-sk" />
      <div class="adm-sk" />
      <div class="adm-sk small" />
    </div>
  </section>
</template>
