<script setup lang="ts">
import { ref } from 'vue'
import { checkUpdate, clearCachesAndReload, currentBuild, formatBuildTime } from '../version'
import { showToast } from '../ui/toast'

/** 页脚版本自检：显示当前构建，可检查远端更新、一键清缓存刷新 */
const build = currentBuild()
const checking = ref(false)
/** 检测到远端更新时高亮提示 */
const outdated = ref(false)

async function runCheck(): Promise<void> {
  if (checking.value) return
  checking.value = true
  try {
    const verdict = await checkUpdate()
    if (verdict === 'outdated') {
      outdated.value = true
      showToast('发现新版本，点「清除缓存并刷新」即可更新', 'info', 4200)
    } else if (verdict === 'latest') {
      showToast('已是最新版本', 'success')
    } else {
      showToast('暂时无法检查更新，请稍后再试', 'error')
    }
  } finally {
    checking.value = false
  }
}

/** 清缓存后必然整页刷新（含失败兜底），无需额外反馈 */
function runClear(): void {
  void clearCachesAndReload()
}
</script>

<template>
  <footer class="ver-foot">
    <span class="ver-text" :class="{ hot: outdated }">ShowMe v{{ build.version }} · 构建于 {{ formatBuildTime(build.buildTime) }}</span>
    <button class="ver-btn" type="button" :disabled="checking" @click="runCheck">
      <span v-if="outdated" class="dot" aria-hidden="true" />{{ checking ? '检查中…' : '检查更新' }}
    </button>
    <button class="ver-btn" type="button" @click="runClear">清除缓存并刷新</button>
  </footer>
</template>

<style scoped>
.ver-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 14px;
  margin-top: 28px;
  padding: 10px 16px 14px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
  user-select: none;
}
.ver-text.hot { color: var(--danger); }
.ver-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  padding: 2px 4px;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.ver-btn:hover { color: var(--accent); }
.ver-btn:disabled { opacity: 0.6; cursor: default; }
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--danger);
}
</style>
