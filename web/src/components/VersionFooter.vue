<script setup lang="ts">
import { ref } from 'vue'
import { prepareForUpdateReload } from '../store/useResume'
import { checkUpdate, clearCachesAndReload, currentBuild } from '../version'
import { showToast } from '../ui/toast'

/** 页脚版本自检：检查到新版本时直接给出更新入口；版本号等细节收进「关于」 */
const build = currentBuild()
const checking = ref(false)
const updating = ref(false)
const outdated = ref(false)

async function runCheck(): Promise<void> {
  if (checking.value || updating.value) return
  checking.value = true
  try {
    const verdict = await checkUpdate()
    if (verdict === 'outdated') {
      outdated.value = true
      showToast('发现新版本，点「立即更新」即可更新', 'info', 4200)
    } else if (verdict === 'latest') {
      outdated.value = false
      showToast('已是最新版本', 'success')
    } else {
      showToast('暂时无法检查更新，请稍后再试', 'error')
    }
  } finally {
    checking.value = false
  }
}

/** 刷新前暂存编辑内容；暂存失败时中止，避免丢失未保存的修改 */
async function reloadFresh(): Promise<void> {
  if (updating.value) return
  updating.value = true
  if (!prepareForUpdateReload()) {
    updating.value = false
    showToast('无法暂存当前编辑内容，请先保存后再更新', 'error', 5000)
    return
  }
  await clearCachesAndReload()
}
</script>

<template>
  <footer class="ver-foot">
    <button
      v-if="outdated"
      class="ver-btn fresh"
      type="button"
      :disabled="updating"
      @click="reloadFresh"
    >
      {{ updating ? '正在更新…' : '立即更新' }}
    </button>
    <button v-else class="ver-btn" type="button" :disabled="checking" @click="runCheck">
      {{ checking ? '检查中…' : '检查更新' }}
    </button>

    <!-- 版本与排障入口收进「关于」，正常使用时不打扰 -->
    <details class="ver-more">
      <summary class="ver-btn">关于</summary>
      <div class="ver-panel">
        <p class="ver-version">ShowMe v{{ build.version }}</p>
        <p class="ver-hint">页面显示异常，或更新后仍是旧版时使用。</p>
        <button class="ver-btn danger" type="button" :disabled="updating" @click="reloadFresh">
          清除缓存并刷新
        </button>
      </div>
    </details>
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
  list-style: none;
}
.ver-btn::-webkit-details-marker { display: none; }
.ver-btn:hover { color: var(--accent); }
.ver-btn:disabled { opacity: 0.6; cursor: default; }
.ver-btn.fresh { color: var(--accent); font-weight: 600; }
.ver-more { position: relative; }
.ver-panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  width: min(240px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--card);
  box-shadow: var(--shadow-md);
  text-align: left;
}
.ver-version { margin: 0; color: var(--ink); font-size: 12.5px; font-weight: 600; }
.ver-hint { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.ver-btn.danger { color: var(--danger); padding: 2px 0; }
</style>
