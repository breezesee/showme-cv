<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { suggestResumeName } from '../store/resumeName'
import { useResume } from '../store/useResume'
import { showToast } from '../ui/toast'

/** 保存弹层内容：命名 + 保存到本机/云端。表单在每次打开时重新创建，自动填入当前名称或建议名 */
const emit = defineEmits<{ done: []; cancel: [] }>()
const { resume, account, docName, docId, library, saving, saveCurrent } = useResume()

const otherNames = computed(() =>
  library.value.filter((d) => d.id !== docId.value).map((d) => d.name),
)

const suggested = computed(() => suggestResumeName(resume.value, otherNames.value))

const name = ref(docName.value || suggested.value)
const error = ref('')
const input = ref<HTMLInputElement>()

const scopeText = computed(() =>
  account.ready
    ? docId.value
      ? '保存会更新简历库中的这一份；修改名称不会新建副本。'
      : '保存后会加入你的云端简历库，可在「我的」中打开、切换或删除。'
    : '未登录：只保存在当前浏览器。登录后可保存多份到云端简历库。',
)

onMounted(async () => {
  await nextTick()
  input.value?.focus()
  input.value?.select()
})

async function submit(): Promise<void> {
  if (saving.value) return
  error.value = ''
  try {
    const result = await saveCurrent(name.value)
    showToast(result.scope === 'cloud' ? '已保存到简历库' : '已保存到当前浏览器', 'success')
    emit('done')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败，请稍后重试'
  }
}
</script>

<template>
  <form class="save-form" @submit.prevent="submit">
    <label class="field">
      <span class="field-label">简历名称</span>
      <input
        ref="input"
        v-model="name"
        maxlength="60"
        placeholder="留空自动命名"
        autocomplete="off"
        enterkeyhint="done"
      />
    </label>

    <p class="hint">
      留空将命名为「{{ suggested }}」<template v-if="account.ready">；同一账号下名称不可重复</template>。
    </p>

    <p class="scope">{{ scopeText }}</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <div class="actions">
      <button class="btn" type="button" @click="emit('cancel')">取消</button>
      <button class="btn btn-primary save-btn" type="submit" :disabled="saving">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.save-form { display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { color: var(--muted); font-size: 12px; font-weight: 500; }
input {
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
input:focus { border-color: var(--accent); box-shadow: var(--ring); }
.hint { margin: 0; }
.scope {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--fill);
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.form-error { margin: 0; color: var(--danger); font-size: 13px; line-height: 1.5; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 2px; }
.save-btn { min-width: 96px; }
</style>
