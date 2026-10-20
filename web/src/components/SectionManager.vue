<script setup lang="ts">
import { computed } from 'vue'
import {
  FIXED_SECTION_IDS,
  SECTION_TITLES,
  customSectionId,
  defaultLayout,
  toggleSectionHidden,
} from '../model/layout'
import type { SectionId } from '../model/resume'
import { useResume } from '../store/useResume'
import { confirmDialog } from '../ui/confirm'
import Icon from './Icon.vue'

/** 板块排序与显隐：直接改工作副本，随简历一起保存 */
const { resume, templateId } = useResume()

interface Row {
  id: SectionId
  title: string
  hidden: boolean
}

const rows = computed<Row[]>(() => {
  const titles = new Map<SectionId, string>()
  for (const id of FIXED_SECTION_IDS) titles.set(id, SECTION_TITLES[id])
  for (const section of resume.value.custom) {
    titles.set(customSectionId(section.id), section.title.trim() || '未命名模块')
  }

  const seen = new Set<SectionId>()
  const order: SectionId[] = []
  for (const id of [...resume.value.layout.order, ...FIXED_SECTION_IDS, ...titles.keys()]) {
    if (titles.has(id) && !seen.has(id)) {
      seen.add(id)
      order.push(id)
    }
  }
  return order.map((id) => ({
    id,
    title: titles.get(id)!,
    hidden: resume.value.layout.hidden.includes(id),
  }))
})

/** 删掉已不存在的自定义模块后再移动，避免与悬空 id 交换 */
function prune(): void {
  const known = new Set(rows.value.map((r) => r.id))
  resume.value.layout.order = resume.value.layout.order.filter((id) => known.has(id))
  resume.value.layout.hidden = resume.value.layout.hidden.filter((id) => known.has(id))
}

function move(id: SectionId, delta: number): void {
  prune()
  const order = resume.value.layout.order
  const from = order.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= order.length) return
  const [item] = order.splice(from, 1)
  order.splice(to, 0, item!)
}

function toggle(id: SectionId): void {
  prune()
  toggleSectionHidden(resume.value.layout, id)
}

async function restore(): Promise<void> {
  const ok = await confirmDialog({
    title: '恢复默认板块设置',
    message: '将按默认顺序显示全部板块，当前的排序与显隐会被覆盖。',
    confirmText: '恢复默认',
  })
  if (ok) resume.value.layout = defaultLayout(resume.value.custom.map((c) => c.id))
}
</script>

<template>
  <div class="manager">
    <ol class="rows">
      <li v-for="(row, i) in rows" :key="row.id" class="row" :class="{ hidden: row.hidden }">
        <div class="moves">
          <button
            class="icon-btn"
            type="button"
            :disabled="i === 0"
            :aria-label="`上移「${row.title}」`"
            @click="move(row.id, -1)"
          >
            <Icon name="up" />
          </button>
          <button
            class="icon-btn"
            type="button"
            :disabled="i === rows.length - 1"
            :aria-label="`下移「${row.title}」`"
            @click="move(row.id, 1)"
          >
            <Icon name="down" />
          </button>
        </div>
        <span class="name">{{ row.title }}</span>
        <span v-if="row.hidden" class="state">已隐藏</span>
        <button
          class="switch"
          type="button"
          role="switch"
          :aria-checked="!row.hidden"
          :aria-label="`在简历中显示「${row.title}」`"
          :class="{ on: !row.hidden }"
          @click="toggle(row.id)"
        >
          <span class="knob" />
        </button>
      </li>
    </ol>
    <p class="hint">顺序与显隐会随简历一起保存、分享和导出。隐藏的板块不会出现在预览和 PDF 中。</p>
    <p v-if="templateId === 'duo'" class="hint">
      「双栏」模板的左右位置固定：教育、技能在左栏，其余在右栏；这里的顺序只在各自栏内生效。
    </p>
    <button class="restore" type="button" @click="restore">恢复默认顺序与显隐</button>
  </div>
</template>

<style scoped>
.manager { display: flex; flex-direction: column; gap: 12px; }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 0 10px 0 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}
.row.hidden .name { color: var(--muted); }
.moves { display: flex; flex: none; }
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
.icon-btn svg { width: 18px; height: 18px; }
.icon-btn:disabled { color: var(--disabled); cursor: default; }
.icon-btn:active:not(:disabled) { background: var(--fill); }
.name { flex: 1; min-width: 0; font-size: 15px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.state { flex: none; font-size: 12px; color: var(--muted); }
.switch {
  flex: none;
  position: relative;
  width: 46px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: var(--fill-strong);
  cursor: pointer;
  transition: background-color 0.2s var(--ease);
}
.switch.on { background: var(--accent); }
.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s var(--ease);
}
.switch.on .knob { transform: translateX(18px); }
.hint { margin: 0; font-size: 12px; line-height: 1.6; color: var(--muted); }
.restore {
  align-self: flex-start;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.restore:active { background: var(--fill); }
</style>
