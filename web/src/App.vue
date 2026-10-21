<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import AccountPanel from './components/AccountPanel.vue'
import AvatarBadge from './components/AvatarBadge.vue'
import ConfirmHost from './components/ConfirmHost.vue'
import ReceivedView from './components/ReceivedView.vue'
import RecoveryScreen from './components/RecoveryScreen.vue'
import RecoveryBanner from './components/RecoveryBanner.vue'
import ResumeEditor from './components/ResumeEditor.vue'
import SaveResumeForm from './components/SaveResumeForm.vue'
import SectionManager from './components/SectionManager.vue'
import SharePanel from './components/SharePanel.vue'
import SharedResumeView from './components/SharedResumeView.vue'
import Sheet from './components/Sheet.vue'
import TemplatePicker from './components/TemplatePicker.vue'
import TemplatePreview from './components/TemplatePreview.vue'
import ThemePicker from './components/ThemePicker.vue'
import ToastHost from './components/ToastHost.vue'
import UpdateBanner from './components/UpdateBanner.vue'
import VersionFooter from './components/VersionFooter.vue'
import Icon, { type IconName } from './components/Icon.vue'
import { CloudRelayError, fetchShortLink } from './relay/cloud'
import { parseRelayHash, type RelayPayload } from './relay/link'
import { clearShareView, consumeShareViewExit, markShareView } from './relay/shareSession'
import { useResume } from './store/useResume'
import { TEMPLATES } from './templates/catalog'
import { THEMES } from './templates/themes'
import { showToast } from './ui/toast'
import { useMediaQuery } from './ui/useMediaQuery'
import { BUILD_TIME } from './version'

const {
  resume, templateId, themeId, initialStatus, account, dirty, docName, savedAt, createNewDocument,
  recoveryDraft, restoreRecovery, dismissRecovery, onboarding, maybeOfferOnboarding, finishOnboarding,
  restoredFromBuild,
} = useResume()
const isWide = useMediaQuery('(min-width: 1100px)')
const editorRef = ref<InstanceType<typeof ResumeEditor>>()
const logo = `${import.meta.env.BASE_URL}icons/icon.svg`

type Tab = 'edit' | 'preview' | 'account'
const TABS: { id: Tab; label: string; title: string; icon: IconName }[] = [
  { id: 'edit', label: '编辑', title: '我的简历', icon: 'edit' },
  { id: 'preview', label: '预览', title: '预览效果', icon: 'eye' },
  { id: 'account', label: '我的', title: '账号与资料', icon: 'user' },
]
const tab = ref<Tab>('edit')
const tabTitle = computed(() => TABS.find((t) => t.id === tab.value)!.title)
const shareOpen = ref(false)
const saveOpen = ref(false)
const accountOpen = ref(false)
const sectionsOpen = ref(false)
const appearanceOpen = ref(false)

/** Sheet 关闭（含右上角与遮罩）等同选择「先看示例」，并标记已引导 */
const onboardingOpen = computed({
  get: () => onboarding.value,
  set: (open: boolean) => {
    if (!open) finishOnboarding(false)
  },
})

/** 当前工作副本的名称与保存状态（顶栏胶囊） */
const docLabel = computed(() => docName.value || '未命名草稿')
const lookSummary = computed(() => {
  const template = TEMPLATES.find((t) => t.id === templateId.value)?.name ?? ''
  const theme = THEMES.find((t) => t.id === themeId.value)?.name ?? ''
  return [template, theme].filter(Boolean).join(' · ')
})
const savedHint = computed(() => {
  if (dirty.value) return '有未保存的修改'
  if (!savedAt.value) return '尚未保存'
  const d = new Date(savedAt.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `已保存 ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

/** 通过接力链接收到、尚未处理的简历（含发送方选择的外观） */
const incoming = shallowRef<RelayPayload | null>(null)

/** 处理地址中的接力数据；返回是否存在接力链接 */
function consumeRelayHash(): boolean {
  const result = parseRelayHash(location.hash)
  if (result.kind === 'none') return false
  // 先清掉地址中的数据：刷新不会重复弹出，数据和密钥也不会留在浏览历史里
  history.replaceState(history.state, '', location.pathname + location.search)
  clearShareView()
  if (result.kind === 'broken') showToast('链接已损坏，未导入任何内容', 'error', 4000)
  else if (result.kind === 'ok') {
    incoming.value = { resume: result.resume, look: result.look, permission: result.permission }
    markShareView()
  } else void receiveShortLink(result.id, result.key)
  return true
}

async function receiveShortLink(id: string, key: string): Promise<void> {
  const dismiss = showToast('正在取回分享的简历…', 'info', 15000)
  try {
    incoming.value = await fetchShortLink(id, key, location.href)
    markShareView()
    dismiss()
  } catch (e) {
    dismiss()
    const message = e instanceof CloudRelayError ? e.message : '无法取回分享内容'
    showToast(`${message}，未导入任何内容`, 'error', 5000)
  }
}

function onHashChange(): void {
  consumeRelayHash()
}

function closeIncoming(): void {
  incoming.value = null
  clearShareView()
  // 接收页会盖住主界面：关掉此前打开的弹层，避免关闭分享后旧表单重新弹出
  shareOpen.value = false
  saveOpen.value = false
  accountOpen.value = false
  window.scrollTo(0, 0)
}

/** 从分享页新建自己的空白简历：不复制对方内容，也不改动自己已有的简历库 */
async function createOwnFromShared(): Promise<void> {
  if (!(await createNewDocument())) return
  closeIncoming()
  selectTab('edit')
  showToast('已新建空白简历，编辑后记得保存', 'info', 3500)
}

function selectTab(next: Tab): void {
  tab.value = next
  window.scrollTo(0, 0)
}

/** 从个人中心打开某份简历后回到编辑器 */
function editFromAccount(): void {
  accountOpen.value = false
  selectTab('edit')
}

/** 投递检查「去修改」：关闭分享页，切到编辑并展开、滚动到对应字段 */
function focusIssue(target: string): void {
  shareOpen.value = false
  if (!isWide.value) selectTab('edit')
  void nextTick(() => editorRef.value?.focusSection(target))
}

function openSave(): void {
  saveOpen.value = true
}

/** 从外观抽屉进入板块管理：先关外层，避免两层弹层叠在一起 */
function openSectionsFromAppearance(): void {
  appearanceOpen.value = false
  void nextTick(() => { sectionsOpen.value = true })
}

/** 找回面板关闭：未登录时把用户带到账号页，方便重新登录或再发邮件 */
function onRecoveryClose(): void {
  if (account.ready) return
  if (isWide.value) accountOpen.value = true
  else selectTab('account')
}

onMounted(() => {
  const relayed = consumeRelayHash()
  window.addEventListener('hashchange', onHashChange)
  if (relayed) return
  if (initialStatus === 'corrupt') showToast('本地简历数据无法读取，已另存原文并载入示例简历', 'error', 5000)
  if (restoredFromBuild.value !== null) {
    const updated = BUILD_TIME > restoredFromBuild.value
    showToast(updated ? '已更新到新版本，编辑内容已恢复' : '编辑内容已恢复', 'success', 4500)
  }
  // 分享页刷新后地址里已没有分享数据：明确告知当前看到的是自己的简历
  if (consumeShareViewExit()) {
    showToast('刷新后已退出分享查看；当前显示的是你自己的简历', 'info', 6500)
  }
  void maybeOfferOnboarding()
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <SharedResumeView
    v-if="incoming && incoming.permission === 'view'"
    :incoming="incoming"
    @close="closeIncoming"
    @create-own="createOwnFromShared"
  />
  <ReceivedView
    v-else-if="incoming"
    :incoming="incoming"
    @close="closeIncoming"
    @create-own="createOwnFromShared"
  />

  <!-- 宽屏：顶部工具栏 + 编辑 / 预览双栏 -->
  <div v-else-if="isWide" class="wide">
    <header class="toolbar glass">
      <div class="brand"><img :src="logo" alt="" width="28" height="28" /><span class="brand-word">ShowMe<span class="brand-dot">.</span></span></div>

      <div class="doc-chip" :title="`${docLabel} · ${savedHint}`">
        <span class="doc-name">{{ docLabel }}</span>
        <span v-if="dirty" class="dirty-dot" aria-label="有未保存的修改" />
      </div>

      <div class="tools">
        <button class="btn" type="button" @click="shareOpen = true"><Icon name="share" />分享与导出</button>
        <button class="btn btn-primary" type="button" @click="openSave"><Icon name="save" />保存</button>
      </div>

      <!-- 账号入口固定在最右侧：未登录是「登录 / 注册」，登录后是头像胶囊 -->
      <div v-if="account.available" class="account-zone">
        <span class="divider" aria-hidden="true" />
        <button
          v-if="account.ready"
          class="account-chip"
          type="button"
          :title="`${account.displayName}（${account.email}）`"
          @click="accountOpen = true"
        >
          <AvatarBadge :path="account.avatarPath" :name="account.displayName" :email="account.email" :size="28" />
          <span class="account-name">{{ account.displayName }}</span>
        </button>
        <button v-else class="btn btn-login" type="button" @click="accountOpen = true">
          <Icon name="user" />登录 / 注册
        </button>
      </div>
    </header>

    <UpdateBanner />

    <div v-if="recoveryDraft" class="wide-banner">
      <RecoveryBanner :at="recoveryDraft.at" @restore="restoreRecovery" @dismiss="dismissRecovery" />
    </div>

    <main class="columns">
      <div class="col-edit"><ResumeEditor ref="editorRef" /></div>
      <div class="col-preview">
        <div class="look-bar">
          <div class="look-group">
            <span class="look-label">模板</span>
            <TemplatePicker v-model="templateId" />
          </div>
          <div class="look-group">
            <span class="look-label">主题</span>
            <ThemePicker v-model="themeId" />
          </div>
          <div class="look-group">
            <span class="look-label">板块</span>
            <button class="look-btn" type="button" @click="sectionsOpen = true"><Icon name="layers" />排序与显隐</button>
          </div>
        </div>
        <TemplatePreview :resume="resume" :template-id="templateId" :theme-id="themeId" bounded />
      </div>
    </main>
    <VersionFooter />
    <Sheet v-model:open="saveOpen" title="保存简历">
      <SaveResumeForm v-if="saveOpen" @done="saveOpen = false" @cancel="saveOpen = false" />
    </Sheet>
    <Sheet v-model:open="shareOpen" title="分享与导出"><SharePanel @edit-target="focusIssue" /></Sheet>
    <Sheet v-model:open="sectionsOpen" title="板块与顺序"><SectionManager v-if="sectionsOpen" /></Sheet>
    <Sheet v-model:open="accountOpen" title="个人中心">
      <AccountPanel v-if="accountOpen" @open-editor="editFromAccount" />
    </Sheet>
  </div>

  <!-- 窄屏：大标题 + 单页内容 + 底部标签栏 -->
  <div v-else class="narrow">
    <header class="large-title">
      <div class="title-main">
        <h1>{{ tabTitle }}</h1>
        <span v-if="tab !== 'account' && dirty" class="unsaved-badge">未保存</span>
      </div>
      <button v-if="tab !== 'account'" class="btn btn-primary save-top" type="button" @click="openSave">
        <Icon name="save" />保存
      </button>
    </header>

    <UpdateBanner />

    <div v-if="recoveryDraft" class="narrow-banner">
      <RecoveryBanner :at="recoveryDraft.at" @restore="restoreRecovery" @dismiss="dismissRecovery" />
    </div>

    <main class="narrow-body">
      <ResumeEditor v-show="tab === 'edit'" ref="editorRef" class="pane" />
      <div v-show="tab === 'preview'" class="preview-page">
        <button class="look-btn mobile-look" type="button" @click="appearanceOpen = true">
          <Icon name="layers" />
          <span class="look-summary">外观：{{ lookSummary }}</span>
          <Icon name="chevron" class="look-chevron" />
        </button>
        <TemplatePreview :resume="resume" :template-id="templateId" :theme-id="themeId" />
        <div class="preview-actions">
          <button class="btn btn-primary btn-block" type="button" @click="shareOpen = true">
            <Icon name="share" />分享与导出
          </button>
        </div>
      </div>
      <AccountPanel v-if="tab === 'account'" class="pane" @open-editor="selectTab('edit')" />
      <VersionFooter />
    </main>

    <nav class="tabbar glass" aria-label="主导航">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="tab"
        :class="{ active: tab === t.id }"
        type="button"
        :aria-current="tab === t.id ? 'page' : undefined"
        @click="selectTab(t.id)"
      >
        <Icon :name="t.icon" />
        <span>{{ t.label }}</span>
      </button>
    </nav>

    <Sheet v-model:open="saveOpen" title="保存简历">
      <SaveResumeForm v-if="saveOpen" @done="saveOpen = false" @cancel="saveOpen = false" />
    </Sheet>
    <Sheet v-model:open="shareOpen" title="分享与导出"><SharePanel @edit-target="focusIssue" /></Sheet>
    <Sheet v-model:open="sectionsOpen" title="板块与顺序"><SectionManager v-if="sectionsOpen" /></Sheet>
    <Sheet v-model:open="appearanceOpen" title="外观">
      <div class="appearance">
        <div class="appearance-group">
          <span class="look-label">模板</span>
          <TemplatePicker v-model="templateId" />
        </div>
        <div class="appearance-group">
          <span class="look-label">主题</span>
          <ThemePicker v-model="themeId" />
        </div>
        <div class="appearance-group">
          <span class="look-label">板块</span>
          <button class="look-btn" type="button" @click="openSectionsFromAppearance"><Icon name="layers" />排序与显隐</button>
        </div>
      </div>
    </Sheet>
  </div>

  <Sheet v-model:open="onboardingOpen" title="开始使用 ShowMe">
    <div class="onboarding">
      <p class="onboarding-lead">现在展示的是一份示例简历。想从空白开始，还是先看看示例？</p>
      <div class="onboarding-choices">
        <button class="onboarding-choice primary" type="button" @click="finishOnboarding(true)">
          <b>从空白开始</b>
          <span>清空示例内容，填写自己的简历</span>
        </button>
        <button class="onboarding-choice" type="button" @click="finishOnboarding(false)">
          <b>先看示例</b>
          <span>保留示例内容，可随意修改</span>
        </button>
      </div>
    </div>
  </Sheet>

  <RecoveryScreen @close="onRecoveryClose" />
  <ConfirmHost />
  <ToastHost />
</template>

<style scoped>
/* ---------- 宽屏 ---------- */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--toolbar-h);
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
}
.brand { --brand-gold: #c4923f; flex: none; display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 700; letter-spacing: 0.2px; }
.brand img { border-radius: 7px; }
.brand-dot { margin-left: -1px; color: var(--brand-gold); }
.doc-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  max-width: 180px;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--fill);
  color: var(--muted);
  font-size: 13px;
}
.doc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dirty-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: #ff9f0a; }
.tools { display: flex; align-items: center; gap: 6px; margin-left: auto; }

/* 账号入口：顶栏最右侧，与操作区用细分隔线隔开 */
.account-zone { flex: none; display: flex; align-items: center; gap: 14px; }
.divider { width: 1px; height: 24px; background: var(--line); }
.btn-login { min-height: 38px; padding: 0 16px; background: var(--fill-strong); font-weight: 600; }
.account-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 190px;
  height: 38px;
  padding: 0 14px 0 5px;
  border: none;
  border-radius: 999px;
  background: var(--fill);
  color: var(--ink);
  font-size: 14px;
  font-weight: 550;
  cursor: pointer;
  transition: background-color 0.2s var(--ease), transform 0.12s var(--ease);
}
.account-chip:hover { background: var(--fill-strong); }
.account-chip:active { transform: scale(0.98); }
.account-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 空间不足时优先收起文档名与账号昵称，保留所有操作 */
@media (max-width: 1360px) {
  .doc-chip { display: none; }
}
@media (max-width: 1230px) {
  .account-chip { width: 38px; padding: 0; justify-content: center; }
  .account-name { display: none; }
  .account-zone { gap: 10px; }
}
@media (max-width: 1140px) {
  .toolbar { gap: 10px; padding: 0 16px; }
  .tools { gap: 2px; }
  .tools .btn { padding: 0 10px; }
}

.columns {
  display: grid;
  grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
  gap: 28px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
  align-items: start;
}
/* 预览栏高度固定为视口内可用高度：内部的「整页」缩放与滚动都在这一栏里完成 */
.col-preview {
  position: sticky;
  top: calc(var(--toolbar-h) + 24px);
  height: calc(100dvh - var(--toolbar-h) - 48px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 8px;
}
.look-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  padding: 0 4px;
}
.look-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 11px;
  background: var(--fill);
  color: var(--ink);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s var(--ease);
}
.look-btn svg { width: 16px; height: 16px; color: var(--muted); }
.look-btn:hover { background: var(--fill-strong); }

/* ---------- 窄屏 ---------- */
.narrow { min-height: 100vh; min-height: 100dvh; }
.large-title {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(20px + var(--safe-top)) calc(20px + var(--safe-right)) 4px calc(20px + var(--safe-left));
}
.title-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
.large-title h1 { margin: 0; font-size: 34px; font-weight: 800; letter-spacing: 0.3px; line-height: 1.15; }
.unsaved-badge {
  flex: none;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning);
  font-size: 12px;
  font-weight: 550;
}
.save-top { flex: none; min-height: 40px; }
.narrow-body {
  padding: 12px calc(16px + var(--safe-right)) calc(var(--tabbar-h) + var(--safe-bottom) + 24px) calc(16px + var(--safe-left));
}
.preview-page { display: flex; flex-direction: column; gap: 16px; }
.preview-actions { display: flex; flex-direction: column; gap: 10px; }

/* 移动端外观入口：一行设置项，替代原来的三组控件 */
.mobile-look {
  width: 100%;
  min-height: 48px;
  justify-content: flex-start;
  padding: 0 14px;
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
}
.mobile-look > svg:first-child { color: var(--muted); }
.look-summary {
  flex: 1;
  min-width: 0;
  margin-left: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.look-chevron { flex: none; width: 16px; height: 16px; color: var(--disabled); }
.appearance { display: flex; flex-direction: column; gap: 22px; }
.appearance-group { display: flex; flex-direction: column; gap: 8px; }
.appearance-group .look-label { font-size: 13px; }

/* 单列布局（窄屏与平板）：编辑 / 分享表单限宽居中，预览保持满宽 */
@media (min-width: 600px) {
  .pane { max-width: 640px; margin-inline: auto; }
}
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  padding: 0 var(--safe-right) var(--safe-bottom) var(--safe-left);
  border-top: 1px solid var(--line);
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: var(--tabbar-h);
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}
.tab svg { width: 24px; height: 24px; }
.tab.active { color: var(--accent); }

/* 未保存草稿横幅与首次引导 */
.wide-banner { max-width: 1440px; margin: 16px auto -6px; padding: 0 24px; }
.narrow-banner { padding: 8px 20px 0; }
.onboarding { display: flex; flex-direction: column; gap: 14px; }
.onboarding-lead { margin: 0; font-size: 15px; line-height: 1.6; }
.onboarding-choices { display: flex; flex-direction: column; gap: 10px; }
.onboarding-choice {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s var(--ease), border-color 0.2s var(--ease);
}
.onboarding-choice b { font-size: 15px; font-weight: 600; }
.onboarding-choice span { color: var(--muted); font-size: 13px; }
.onboarding-choice.primary { border-color: rgba(0, 113, 227, 0.45); background: rgba(0, 113, 227, 0.05); }
.onboarding-choice:hover { background: var(--fill); }
</style>
