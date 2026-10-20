<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { avatarPublicUrl } from '../cloud/client'
import { displayInitial } from '../cloud/profile'

/** 账号头像：有图显示图片，加载失败或缺省时回退到昵称首字 */
const props = withDefaults(
  defineProps<{
    path: string
    name: string
    email?: string
    size?: number
  }>(),
  { email: '', size: 48 },
)

const failed = ref(false)
watch(() => props.path, () => { failed.value = false })

const url = computed(() => avatarPublicUrl(props.path))
const initial = computed(() => displayInitial(props.name, props.email))
</script>

<template>
  <span class="avatar-badge" :style="{ '--size': `${size}px` }">
    <img v-if="url && !failed" :src="url" alt="" @error="failed = true" />
    <span v-else class="initial" aria-hidden="true">{{ initial }}</span>
  </span>
</template>

<style scoped>
.avatar-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  overflow: hidden;
  background: rgba(0, 113, 227, 0.12);
  color: var(--accent);
  font-size: calc(var(--size) * 0.42);
  font-weight: 700;
  line-height: 1;
  user-select: none;
}
.avatar-badge img { width: 100%; height: 100%; object-fit: cover; }
</style>
