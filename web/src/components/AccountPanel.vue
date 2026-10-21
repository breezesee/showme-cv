<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ResumeMeta } from '../cloud/library'
import { useResume } from '../store/useResume'
import { showToast } from '../ui/toast'
import AuthForm from './AuthForm.vue'
import Icon from './Icon.vue'
import ProfileCard from './ProfileCard.vue'
import SupportCard from './SupportCard.vue'

/** 个人中心：未登录显示登录表单；已登录显示资料、简历库与退出登录 */
const emit = defineEmits<{ 'open-editor': [] }>()

const {
  account,
  library,
  libraryLoading,
  libraryError,
  openingId,
  docId,
  docName,
  dirty,
  savedAt,
  openDocFromLibrary,
  createNewDocument,
  deleteLibraryDoc,
  duplicateLibraryDoc,
  refreshLibrary,
  logout,
} = useResume()

const savedText = computed(() => {
  if (dirty.value) return '有未保存的修改'
  if (!savedAt.value) return '尚未保存'
  const d = new Date(savedAt.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `已保存 ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

// ---------- 简历库 ----------
const pad = (n: number) => String(n).padStart(2, '0')

function formatUpdated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay
    ? `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function openDoc(id: string): Promise<void> {
  if (await openDocFromLibrary(id)) emit('open-editor')
}

async function newDoc(): Promise<void> {
  if (!(await createNewDocument())) return
  showToast('已新建空白简历，编辑后记得保存', 'info', 3500)
  emit('open-editor')
}

async function removeDoc(meta: ResumeMeta): Promise<void> {
  await deleteLibraryDoc(meta)
}

const duplicatingId = ref('')

async function duplicateDoc(meta: ResumeMeta): Promise<void> {
  if (duplicatingId.value) return
  duplicatingId.value = meta.id
  try {
    await duplicateLibraryDoc(meta)
  } finally {
    duplicatingId.value = ''
  }
}

async function doLogout(): Promise<void> {
  await logout()
}
</script>

<template>
  <div class="account">
    <!-- 云服务未配置：说明情况，本地能力不受影响 -->
    <section v-if="!account.available" class="card panel state">
      <h2>云端功能暂未启用</h2>
      <p class="hint">云端功能暂时不可用。编辑、保存到本机、导出和分享都不受影响。</p>
    </section>

    <!-- 启动时正在恢复上次的登录会话 -->
    <section v-else-if="account.restoring" class="card panel state">
      <p class="hint">正在恢复登录状态…</p>
    </section>

    <!-- 未登录：一句价值说明 + 登录注册 -->
    <template v-else-if="!account.ready">
      <section class="card panel intro">
        <h2>登录后，简历跟着你走</h2>
        <p class="hint">云端保存多份简历，换设备接着改；不登录也能保存在这台设备。</p>
      </section>

      <section class="card panel">
        <AuthForm />
      </section>
    </template>

    <!-- 已登录：资料 + 简历库 + 账号操作 -->
    <template v-else>
      <ProfileCard />

      <section class="card panel">
        <header class="panel-head">
          <div>
            <h3>我的简历库</h3>
            <p class="hint">
              {{ libraryLoading ? '正在加载…' : `${library.length} 份 · 保存在云端` }}
            </p>
          </div>
          <div class="head-actions">
            <button class="link-btn" type="button" :disabled="libraryLoading" @click="refreshLibrary">刷新</button>
            <button class="btn" type="button" @click="newDoc"><Icon name="plus" />新建</button>
          </div>
        </header>

        <p v-if="libraryError" class="notice" role="alert">{{ libraryError }}</p>

        <ul v-if="library.length" class="library-list">
          <li
            v-for="doc in library"
            :key="doc.id"
            class="doc-row"
            :class="{ current: doc.id === docId }"
          >
            <button class="doc-main" type="button" :disabled="openingId === doc.id" @click="openDoc(doc.id)">
              <span class="doc-title">
                {{ doc.name }}
                <span v-if="doc.id === docId" class="badge">当前</span>
              </span>
              <span class="doc-meta">
                {{ openingId === doc.id ? '正在打开…' : `更新于 ${formatUpdated(doc.updatedAt)}` }}
              </span>
            </button>
            <button
              class="icon-btn"
              type="button"
              :aria-label="`复制 ${doc.name}`"
              :title="`复制 ${doc.name}`"
              :disabled="duplicatingId === doc.id"
              @click="duplicateDoc(doc)"
            >
              <Icon name="copy" />
            </button>
            <button
              class="icon-btn danger"
              type="button"
              :aria-label="`删除 ${doc.name}`"
              :title="`删除 ${doc.name}`"
              @click="removeDoc(doc)"
            >
              <Icon name="trash" />
            </button>
          </li>
        </ul>

        <div v-else-if="!libraryLoading && !libraryError" class="empty">
          <p class="empty-title">简历库还是空的</p>
          <p class="hint">点击「新建」写一份新的，或编辑当前内容后点「保存」。</p>
        </div>

        <p class="current-line hint">
          当前编辑：<b>{{ docName || '未命名草稿' }}</b> · {{ savedText }}
        </p>
      </section>
    </template>

    <SupportCard />

    <section v-if="account.ready" class="card panel session">
      <div>
        <p class="session-title">账号</p>
        <p class="hint">退出后，本机保存的简历和云端简历库都不会被删除。</p>
      </div>
      <button class="btn btn-danger" type="button" @click="doLogout">退出登录</button>
    </section>
  </div>
</template>

<style scoped>
.account { display: flex; flex-direction: column; gap: 14px; }
.panel { padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }

/* 状态与未登录 */
.state { align-items: flex-start; }
.state h2 { margin: 0; font-size: 19px; font-weight: 650; }
.state .hint { margin: 0; }
.intro { gap: 6px; }
.intro h2 { margin: 0; font-size: 19px; font-weight: 650; letter-spacing: 0.2px; }
.intro .hint { margin: 0; }

/* 简历库 */
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.panel-head h3 { margin: 0 0 2px; font-size: 17px; font-weight: 600; }
.panel-head .hint { margin: 0; }
.head-actions { display: flex; align-items: center; gap: 10px; flex: none; }

.library-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.doc-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 2px 4px 2px 14px;
  transition: background-color 0.2s var(--ease), border-color 0.2s var(--ease);
}
.doc-row:hover { background: var(--fill); }
.doc-row.current { background: rgba(0, 113, 227, 0.06); border-color: rgba(0, 113, 227, 0.32); }
.doc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}
.doc-main:disabled { opacity: 0.6; cursor: default; }
.doc-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 550; word-break: break-all; }
.badge {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
}
.doc-meta { color: var(--muted); font-size: 12px; }
.icon-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background-color 0.2s var(--ease), color 0.2s var(--ease);
}
.icon-btn svg { width: 17px; height: 17px; }
.icon-btn:hover { background: var(--fill-strong); color: var(--ink); }
.icon-btn:disabled { opacity: 0.4; cursor: default; }
.icon-btn.danger:hover { background: rgba(255, 59, 48, 0.1); color: var(--danger); }

.empty {
  padding: 18px 14px;
  border: 1.5px dashed var(--line);
  border-radius: var(--radius-sm);
  text-align: center;
}
.empty-title { margin: 0 0 3px; font-size: 14px; font-weight: 550; }
.empty .hint { margin: 0; }
.current-line { margin: 2px 0 0; }
.current-line b { color: var(--ink); font-weight: 550; }
.notice { margin: 0; }

/* 账号操作 */
.session { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.session-title { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
.session .hint { margin: 0; }

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}
.link-btn:hover { text-decoration: underline; }
.link-btn:disabled { color: var(--disabled); cursor: default; text-decoration: none; }

@media (max-width: 1099.98px) {
  .panel { padding: 16px 18px; }
}
</style>
