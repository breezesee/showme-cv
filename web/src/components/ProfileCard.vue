<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { account, changeEmail, refreshAccount, updateAvatarPath } from '../cloud/account'
import { deleteAvatar, uploadAvatar } from '../cloud/avatars'
import { emailChangeErrorMessage } from '../cloud/authErrors'
import { emailError, normalizeEmail } from '../model/email'
import { validatePhotoFile } from '../model/photo'
import { processAvatar } from '../photo/process'
import { useResume } from '../store/useResume'
import { showToast } from '../ui/toast'
import AvatarBadge from './AvatarBadge.vue'
import Icon from './Icon.vue'

/** 个人资料：头像、昵称、邮箱换绑 */
const { saveProfileName } = useResume()

const joined = computed(() => {
  if (!account.createdAt) return ''
  const d = new Date(account.createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月加入`
})

// ---------- 头像 ----------
const avatarInput = ref<HTMLInputElement>()
const uploadingAvatar = ref(false)
const avatarError = ref('')

function chooseAvatar(): void {
  if (!uploadingAvatar.value) avatarInput.value?.click()
}

async function onAvatarChange(event: Event): Promise<void> {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file) return
  const problem = validatePhotoFile(file)
  if (problem) {
    avatarError.value = problem
    return
  }
  const previous = account.avatarPath
  uploadingAvatar.value = true
  avatarError.value = ''
  try {
    const jpeg = await processAvatar(file)
    const path = await uploadAvatar(jpeg)
    await updateAvatarPath(path)
    if (previous && previous !== path) void deleteAvatar(previous)
    showToast('头像已更新', 'success')
  } catch (e) {
    avatarError.value = e instanceof Error ? e.message : '头像上传失败，请重试'
  } finally {
    uploadingAvatar.value = false
  }
}

async function removeAvatar(): Promise<void> {
  const previous = account.avatarPath
  if (!previous || uploadingAvatar.value) return
  uploadingAvatar.value = true
  avatarError.value = ''
  try {
    await updateAvatarPath(null)
    void deleteAvatar(previous)
    showToast('已恢复默认头像', 'success')
  } catch (e) {
    avatarError.value = e instanceof Error ? e.message : '头像移除失败，请重试'
  } finally {
    uploadingAvatar.value = false
  }
}

// ---------- 昵称 ----------
const editingName = ref(false)
const nameDraft = ref('')
const savingName = ref(false)
const nameError = ref('')
const nameInput = ref<HTMLInputElement>()

async function startEditName(): Promise<void> {
  nameDraft.value = account.displayName
  editingName.value = true
  nameError.value = ''
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function cancelEditName(): void {
  editingName.value = false
  nameError.value = ''
}

async function submitName(): Promise<void> {
  if (savingName.value) return
  savingName.value = true
  nameError.value = ''
  try {
    await saveProfileName(nameDraft.value)
    editingName.value = false
    showToast('昵称已更新', 'success')
  } catch (e) {
    nameError.value = e instanceof Error ? e.message : '资料保存失败，请稍后重试'
  } finally {
    savingName.value = false
  }
}

// ---------- 换绑邮箱 ----------
const editingEmail = ref(false)
const emailDraft = ref('')
const savingEmail = ref(false)
const emailFormError = ref('')
const emailInput = ref<HTMLInputElement>()
const refreshingEmail = ref(false)

async function startEditEmail(): Promise<void> {
  emailDraft.value = ''
  editingEmail.value = true
  emailFormError.value = ''
  await nextTick()
  emailInput.value?.focus()
}

function cancelEditEmail(): void {
  editingEmail.value = false
  emailFormError.value = ''
}

async function submitEmail(): Promise<void> {
  if (savingEmail.value) return
  const next = normalizeEmail(emailDraft.value)
  const problem = emailError(next)
  if (problem) {
    emailFormError.value = problem
    return
  }
  if (next.toLowerCase() === account.email.toLowerCase()) {
    emailFormError.value = '新邮箱与当前邮箱相同'
    return
  }
  savingEmail.value = true
  emailFormError.value = ''
  try {
    await changeEmail(next)
    editingEmail.value = false
    showToast('确认邮件已发送，请打开邮箱完成验证', 'success', 5500)
  } catch (e) {
    emailFormError.value = emailChangeErrorMessage(e)
  } finally {
    savingEmail.value = false
  }
}

async function refreshEmailState(): Promise<void> {
  if (refreshingEmail.value) return
  refreshingEmail.value = true
  const before = account.pendingEmail
  try {
    await refreshAccount()
    if (before && !account.pendingEmail) showToast('邮箱已更新', 'success')
    else if (account.pendingEmail) showToast('尚未确认，请打开邮件中的链接', 'info', 4000)
    else showToast('状态已刷新', 'info')
  } finally {
    refreshingEmail.value = false
  }
}
</script>

<template>
  <section class="card panel profile">
    <div class="avatar-col">
      <div class="avatar-wrap">
        <AvatarBadge :path="account.avatarPath" :name="account.displayName" :email="account.email" :size="64" />
        <button
          class="avatar-edit"
          type="button"
          :disabled="uploadingAvatar"
          :aria-label="account.avatarPath ? '更换头像' : '上传头像'"
          :title="account.avatarPath ? '更换头像' : '上传头像'"
          @click="chooseAvatar"
        >
          <Icon name="camera" />
        </button>
      </div>
      <button v-if="account.avatarPath" class="link-btn remove-avatar" type="button" :disabled="uploadingAvatar" @click="removeAvatar">
        {{ uploadingAvatar ? '处理中…' : '移除头像' }}
      </button>
      <input
        ref="avatarInput"
        class="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabindex="-1"
        aria-hidden="true"
        @change="onAvatarChange"
      />
    </div>

    <div class="profile-main">
      <div v-if="!editingName" class="name-row">
        <strong class="display-name">{{ account.displayName }}</strong>
        <button class="link-btn" type="button" @click="startEditName">修改昵称</button>
      </div>
      <form v-else class="inline-form" @submit.prevent="submitName">
        <input
          ref="nameInput"
          v-model="nameDraft"
          maxlength="40"
          aria-label="昵称"
          placeholder="给自己起个昵称"
        />
        <button class="btn btn-primary" type="submit" :disabled="savingName">{{ savingName ? '保存中…' : '保存' }}</button>
        <button class="btn" type="button" @click="cancelEditName">取消</button>
      </form>
      <p v-if="nameError" class="form-error" role="alert">{{ nameError }}</p>

      <div v-if="!editingEmail" class="email-row">
        <span class="email">{{ account.email }}</span>
        <button class="link-btn" type="button" @click="startEditEmail">更换</button>
      </div>
      <form v-else class="inline-form email-form" novalidate @submit.prevent="submitEmail">
        <input
          ref="emailInput"
          v-model="emailDraft"
          type="email"
          inputmode="email"
          autocomplete="email"
          aria-label="新邮箱"
          placeholder="新邮箱地址"
        />
        <button class="btn btn-primary" type="submit" :disabled="savingEmail">{{ savingEmail ? '发送中…' : '发送确认' }}</button>
        <button class="btn" type="button" @click="cancelEditEmail">取消</button>
      </form>
      <p v-if="emailFormError" class="form-error" role="alert">{{ emailFormError }}</p>

      <p v-if="account.pendingEmail" class="pending">
        待确认：<b>{{ account.pendingEmail }}</b>
        <button class="link-btn" type="button" :disabled="refreshingEmail" @click="refreshEmailState">
          {{ refreshingEmail ? '刷新中…' : '刷新状态' }}
        </button>
      </p>

      <p v-if="avatarError" class="form-error" role="alert">{{ avatarError }}</p>
      <p v-if="joined" class="hint joined">{{ joined }}</p>
    </div>
  </section>
</template>

<style scoped>
.profile { flex-direction: row; align-items: flex-start; gap: 16px; }
.avatar-col { flex: none; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.avatar-wrap { position: relative; }
.avatar-edit {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 2px solid var(--card);
  border-radius: 50%;
  background: var(--fill-strong);
  color: var(--ink);
  cursor: pointer;
  transition: background-color 0.2s var(--ease);
}
.avatar-edit:hover { background: var(--accent); color: #fff; }
.avatar-edit:disabled { opacity: 0.5; cursor: default; }
.avatar-edit svg { width: 15px; height: 15px; }
.remove-avatar { font-size: 12px; }
.file-input { display: none; }

.profile-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.name-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.display-name { font-size: 18px; font-weight: 650; word-break: break-all; }
.inline-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.inline-form input {
  flex: 1 1 160px;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 15px;
  outline: none;
}
.inline-form input:focus { border-color: var(--accent); box-shadow: var(--ring); }
.email-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.email { color: var(--muted); font-size: 13px; word-break: break-all; }
.pending { margin: 2px 0 0; color: var(--warning); font-size: 13px; line-height: 1.5; word-break: break-all; }
.pending b { font-weight: 600; }
.joined { margin: 0; }
.form-error { margin: 2px 0 0; color: var(--danger); font-size: 13px; }

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
  .avatar-edit { width: 36px; height: 36px; }
}
</style>
