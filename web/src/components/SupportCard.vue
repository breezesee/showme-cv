<script setup lang="ts">
import Icon from './Icon.vue'

/** 反馈与支持：登录前后都展示，不依赖云服务 */
const EMAIL = '1712615051@qq.com'
const GITHUB = 'https://github.com/miraclesee/showme-cv'
</script>

<template>
  <section class="card panel support">
    <header class="support-head">
      <h3>反馈与支持</h3>
      <p class="hint">遇到问题、想要新功能，或只是想聊聊，都欢迎联系。</p>
    </header>
    <div class="support-links">
      <a class="support-row" :href="`mailto:${EMAIL}?subject=ShowMe%20%E5%8F%8D%E9%A6%88`">
        <span class="support-icon" aria-hidden="true"><Icon name="mail" /></span>
        <span class="support-text">
          <b>邮件反馈</b>
          <small>{{ EMAIL }}</small>
        </span>
        <Icon name="chevron" class="chevron" />
      </a>
      <a class="support-row" :href="GITHUB" target="_blank" rel="noopener noreferrer">
        <span class="support-icon star" aria-hidden="true"><Icon name="star" /></span>
        <span class="support-text">
          <b>在 GitHub 点个 Star</b>
          <small>喜欢的话，给作者一点支持</small>
        </span>
        <Icon name="chevron" class="chevron" />
      </a>
    </div>
  </section>
</template>

<style scoped>
.support { padding: 16px 20px; gap: 10px; }
.support-head { display: flex; flex-direction: column; gap: 2px; }
.support-head h3 { margin: 0; font-size: 16px; font-weight: 600; }
.support-head .hint { margin: 0; }
.support-links { display: flex; flex-direction: column; gap: 6px; }
.support-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  margin: 0 -10px;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  transition: background-color 0.2s var(--ease);
}
.support-row:hover { background: var(--fill); }
.support-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(0, 113, 227, 0.1);
  color: var(--accent);
}
.support-icon.star { background: rgba(196, 146, 63, 0.14); color: #c4923f; }
.support-icon svg { width: 17px; height: 17px; }
.support-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.support-text b { font-size: 14px; font-weight: 550; }
.support-text small { color: var(--muted); font-size: 12px; word-break: break-all; }
.chevron { flex: none; width: 16px; height: 16px; color: var(--disabled); }
</style>
