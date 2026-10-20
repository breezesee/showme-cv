<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { account } from '../cloud/account'
import { photoPublicUrl } from '../cloud/client'
import { uploadResumePhoto } from '../cloud/photos'
import { validatePhotoFile } from '../model/photo'
import { processPhoto } from '../photo/process'
import { showToast } from '../ui/toast'
import Icon from './Icon.vue'

/** 可选照片：仅登录后可上传；未上传时不渲染任何占位 */
const photo = defineModel<string>({ required: true })
const emit = defineEmits<{ 'need-login': [] }>()

const input = ref<HTMLInputElement>()
const busy = ref(false)
const previewFailed = ref(false)
const url = computed(() => photoPublicUrl(photo.value))

watch(photo, () => {
  previewFailed.value = false
})

const note = computed(() => {
  if (!account.available) return '云服务未配置，照片功能暂不可用'
  if (account.restoring) return '正在恢复登录状态…'
  if (!account.ready) return '登录后可上传；照片保存在云端，不随 JSON 备份导出'
  if (busy.value) return '正在处理照片…'
  return '支持 JPG / PNG / WebP，不超过 10MB；会裁成 5:7 并压缩'
})

const disabled = computed(() => !account.available || busy.value || account.restoring)

function choose(): void {
  if (disabled.value) return
  if (!account.ready) {
    emit('need-login')
    return
  }
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
    const jpeg = await processPhoto(file)
    photo.value = await uploadResumePhoto(jpeg)
    showToast('照片已上传', 'success')
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
.photo-field { display: flex; flex-direction: column; gap: 10px; }
.photo-head { display: flex; align-items: baseline; gap: 8px; padding-left: 4px; }
.photo-title { font-size: 13px; color: var(--muted); }
.photo-optional { font-size: 12px; color: var(--disabled); }
.photo-row { display: flex; align-items: center; gap: 14px; }
.photo-frame {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 123px;
  border-radius: 10px;
  background: var(--bg);
  overflow: hidden;
}
.photo-frame.empty { border: 1px dashed var(--line); color: var(--disabled); }
.photo-frame img { width: 100%; height: 100%; object-fit: cover; }
.photo-frame svg { width: 30px; height: 30px; }
.photo-actions { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.photo-buttons { display: flex; align-items: center; gap: 8px; }
.upload, .remove {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 38px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
}
.upload { background: var(--fill); color: var(--accent); }
.upload svg { width: 15px; height: 15px; }
.upload:disabled { opacity: 0.5; cursor: default; }
.remove { background: transparent; color: var(--danger); }
.remove:disabled { opacity: 0.5; cursor: default; }
.note { margin: 0; font-size: 12px; line-height: 1.55; color: var(--muted); }
.file-input { display: none; }
</style>
