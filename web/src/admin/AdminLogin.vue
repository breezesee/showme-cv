<script setup lang="ts">
import { onMounted, ref } from 'vue'

defineProps<{ busy: boolean; error: string; base: string }>()
const emit = defineEmits<{ submit: [email: string, password: string] }>()

const email = ref('')
const password = ref('')
const emailInput = ref<HTMLInputElement>()

onMounted(() => emailInput.value?.focus())

function submit(): void {
  const account = email.value.trim()
  if (!account || !password.value) return
  emit('submit', account, password.value)
}
</script>

<template>
  <div class="adm-login-page">
    <div class="adm-login">
      <aside class="adm-login-aside">
        <div class="adm-login-top">
          <p class="adm-login-brand">ShowMe<span class="adm-dot">.</span></p>
          <span class="adm-login-tag">管理台</span>
        </div>
        <div class="adm-login-statement">
          <p class="adm-login-kicker">内部工具 · 仅限授权</p>
          <h1>把每一份简历<br />照顾好。</h1>
          <p class="adm-login-copy">运营数据、账号支持与操作审计。涉及账号的敏感操作都会留下记录。</p>
        </div>
        <p class="adm-login-foot">运营数据 · 用户支持 · 操作审计</p>
      </aside>

      <section class="adm-login-form">
        <p class="adm-eyebrow">管理员登录</p>
        <h2>进入管理台</h2>
        <p class="adm-login-hint">使用你的 ShowMe 账号登录。只有 app_metadata.role = admin 的账号可以进入。</p>

        <form @submit.prevent="submit">
          <div class="adm-field">
            <label for="adm-email">邮箱</label>
            <input
              id="adm-email"
              ref="emailInput"
              v-model.trim="email"
              type="email"
              name="email"
              autocomplete="username"
              spellcheck="false"
              required
            />
          </div>
          <div class="adm-field">
            <label for="adm-password">密码</label>
            <input
              id="adm-password"
              v-model="password"
              type="password"
              name="password"
              autocomplete="current-password"
              required
            />
          </div>

          <p v-if="error" class="adm-error" role="alert">{{ error }}</p>

          <button
            class="btn btn-primary btn-block"
            type="submit"
            :disabled="busy || !email.trim() || !password"
          >
            {{ busy ? '正在验证…' : '进入管理台' }}
          </button>
        </form>

        <a class="adm-login-back" :href="base">返回简历编辑器</a>
      </section>
    </div>
  </div>
</template>
