<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { session } from '../store/storage'
import { prepareForUpdateReload } from '../store/useResume'
import { showToast } from '../ui/toast'
import {
  clearCachesAndReload,
  currentBuild,
  fetchRemoteBuildInfo,
  formatBuildTime,
  judgeUpdate,
  type BuildInfo,
} from '../version'
import Icon from './Icon.vue'

/**
 * 新版本提示：进入应用时强制检查 version.json，回到前台时节流复查。
 * 更新前把编辑状态交给 store 写入交接快照，再清缓存整页刷新。
 */
const DISMISS_KEY = 'showme.updateDismissed.v1'
const RECHECK_INTERVAL_MS = 5 * 60 * 1000

const remote = ref<BuildInfo | null>(null)
const dismissed = ref(readDismissed())
const checking = ref(false)
const updating = ref(false)
let lastCheckedAt = 0

const build = currentBuild()
const visible = computed(
  () => remote.value !== null && remote.value.buildTime !== dismissed.value,
)

function readDismissed(): number | null {
  const raw = session.get(DISMISS_KEY)
  if (raw === null) return null
  try {
    const at = (JSON.parse(raw) as { buildTime?: unknown }).buildTime
    return typeof at === 'number' && Number.isFinite(at) ? at : null
  } catch {
    return null
  }
}

function dismiss(): void {
  if (!remote.value) return
  dismissed.value = remote.value.buildTime
  session.set(DISMISS_KEY, JSON.stringify({ buildTime: remote.value.buildTime }))
}

/** force=true 用于页面进入；回到前台时 5 分钟内不重复请求 */
async function runCheck(force = false): Promise<void> {
  if (checking.value) return
  if (!force && Date.now() - lastCheckedAt < RECHECK_INTERVAL_MS) return
  checking.value = true
  lastCheckedAt = Date.now()
  try {
    const info = await fetchRemoteBuildInfo()
    if (info && judgeUpdate(info, build) === 'outdated') remote.value = info
  } finally {
    checking.value = false
  }
}

async function runUpdate(): Promise<void> {
  if (updating.value) return
  updating.value = true
  if (!prepareForUpdateReload()) {
    updating.value = false
    showToast('无法暂存当前编辑内容，请先保存后再更新', 'error', 5000)
    return
  }
  await clearCachesAndReload()
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') void runCheck()
}

onMounted(() => {
  void runCheck(true)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange))
</script>

<template>
  <div v-if="visible && remote" class="update" role="region" aria-label="版本更新提示">
    <Icon name="download" class="update-icon" />
    <div class="update-text">
      <b>发现新版本</b>
      <span>新版本构建于 {{ formatBuildTime(remote.buildTime) }}，更新后当前编辑内容会自动保留。</span>
    </div>
    <div class="update-actions">
      <button class="btn btn-plain update-later" type="button" @click="dismiss">稍后</button>
      <button class="btn btn-primary update-now" type="button" :disabled="updating" @click="runUpdate">
        {{ updating ? '正在更新…' : '立即更新' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.update {
  position: relative;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(1392px, calc(100% - 48px));
  margin: 14px auto -4px;
  padding: 10px 12px 10px 16px;
  border: 1px solid rgba(0, 113, 227, 0.24);
  border-radius: var(--radius);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}
.update-icon { flex: none; width: 20px; height: 20px; color: var(--accent); }
.update-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 13.5px; line-height: 1.45; }
.update-text b { font-weight: 600; }
.update-text span { color: var(--muted); font-size: 12.5px; }
.update-actions { flex: none; display: flex; align-items: center; gap: 6px; }
.update-actions .btn { min-height: 34px; padding: 0 14px; font-size: 13.5px; }
@media (max-width: 1099.98px) {
  .update {
    width: auto;
    margin: 8px 16px 0;
    padding: 12px 14px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .update-text { flex-basis: calc(100% - 32px); }
  .update-actions { width: 100%; justify-content: flex-end; }
  .update-actions .btn { min-height: 42px; }
}
</style>
