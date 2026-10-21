<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { account } from '../cloud/account'
import { photoPublicUrl } from '../cloud/client'
import { uploadResumePhoto } from '../cloud/photos'
import { validatePhotoFile } from '../model/photo'
import { processPhoto, processPhotoLocal } from '../photo/process'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'

/** 可选照片：登录后上传到云端；未登录时本地处理为 data URL；未上传时不渲染占位 */
const photo = defineModel<string>({ required: true })

const input = ref<HTMLInputElement>()
const busy = ref(false)
const previewFailed = ref(false)
const url = computed(() => photoPublicUrl(photo.value))

watch(photo, () => {
  previewFailed.value = false
})

const note = computed(() => {
  if (account.restoring) return '正在恢复登录状态…'
  if (busy.value) return '正在处理照片…'
  if (account.ready) return '支持 JPG、PNG、WebP，10MB 以内；会自动裁成证件照比例，随简历保存到云端'
  return '支持 JPG、PNG、WebP，10MB 以内；会自动裁成证件照比例。照片只保存在本机，备份或分享时会一起带走'
})

const disabled = computed(() => busy.value || account.restoring)

function choose(): void {
  if (disabled.value) return
  input.value?.click()
}

async function onChange(event: Event): Promise<void> {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file) return
  const problem = validatePhotoFile(file)
  if (problem) {
    showToast(problem, 'error')
    return
  }
  busy.value = true
  try {
    if (account.ready) {
      const jpeg = await processPhoto(file)
      photo.value = await uploadResumePhoto(jpeg)
      showToast('照片已上传', 'success')
    } else {
      photo.value = await processPhotoLocal(file)
      showToast('照片已添加，会保存在本机', 'success')
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : '照片上传失败，请重试', 'error')
  } finally {
    busy.value = false
  }
}

function remove(): void {
  photo.value = ''
}
</script>

<template>
  <div class="photo-field">
    <div class="photo-head">
      <span class="photo-title">照片</span>
      <span class="photo-optional">可选</span>
    </div>
    <div class="photo-row">
      <div class="photo-frame" :class="{ empty: !url || previewFailed }">
        <img v-if="url && !previewFailed" :src="url" alt="简历照片预览" @error="previewFailed = true" />
        <Icon v-else name="user" />
      </div>
      <div class="photo-actions">
        <div class="photo-buttons">
          <button class="upload" type="button" :disabled="disabled" @click="choose">
            <Icon name="upload" />{{ busy ? '上传中…' : url ? '更换照片' : '上传照片' }}
          </button>
          <button v-if="photo" class="remove" type="button" :disabled="busy" @click="remove">移除</button>
        </div>
        <p class="note">{{ note }}</p>
      </div>
      <input
        ref="input"
        class="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabindex="-1"
        aria-hidden="true"
        @change="onChange"
      />
    </div>
  </div>
</template>

<style scoped>
.photo-field { display: flex; flex-direction: column; gap: 8px; }
.photo-head { display: flex; align-items: baseline; gap: 8px; padding-left: 4px; }
.photo-title { font-size: 13px; color: var(--muted); }
.photo-optional { font-size: 12px; color: var(--disabled); }
.photo-row { display: flex; align-items: center; gap: 12px; }
.photo-frame {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 78px;
  border-radius: 8px;
  background: var(--bg);
  overflow: hidden;
}
.photo-frame.empty { border: 1px dashed var(--line); color: var(--disabled); }
.photo-frame img { width: 100%; height: 100%; object-fit: cover; }
.photo-frame svg { width: 22px; height: 22px; }
.photo-actions { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.photo-buttons { display: flex; align-items: center; gap: 4px; }
.upload, .remove {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 550;
  cursor: pointer;
}
.upload { background: var(--fill); color: var(--accent); }
.upload svg { width: 14px; height: 14px; }
.upload:disabled { opacity: 0.5; cursor: default; }
.remove { background: transparent; color: var(--danger); }
.remove:disabled { opacity: 0.5; cursor: default; }
.note { margin: 0; font-size: 12px; line-height: 1.45; color: var(--muted); }
.file-input { display: none; }
</style>
