<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isResumeEmpty, type Resume } from '../model/resume'
import { loadZoomPref, PREVIEW_ZOOMS, saveZoomPref, type PreviewZoom } from '../store/prefs'
import type { TemplateId } from '../templates/catalog'
import { fetchTemplate, injectData, renderPayload, type ShowmeWindow } from '../templates/loader'
import type { ThemeId } from '../templates/themes'
import Icon from './Icon.vue'

/**
 * 实时预览：模板以 srcdoc 载入同源 iframe，数据变化时直接调用 __showme_render 重绘（不重载文档）。
 * 模板运行时把内容分到多张 A4 纸（.sheet），预览显示的就是打印出来的分页；
 * iframe 固定按 A4 宽度排版，再整体等比缩放到容器宽度。
 *
 * bounded=true 表示容器有固定高度（桌面双栏里的粘性预览栏）：此时可用「整页」缩放，
 * 纸张按容器高度整体缩到一屏内；窄屏（页面自身滚动）自动退回按宽度缩放，另提供「放大」全屏查看。
 */
const props = withDefaults(
  defineProps<{ resume: Resume; templateId: TemplateId; themeId: ThemeId; bounded?: boolean }>(),
  { bounded: false },
)

const PAGE_W = 794
const PAGE_H = 1123
const MIN_SCALE = 0.25
const RENDER_DELAY = 120
const ZOOM_LABELS: Record<PreviewZoom, string> = { page: '整页', width: '适宽', actual: '100%' }
// 去掉模板自带的灰底与外边距，纸张间隔透出外层背景；阴影会被 iframe 边界裁掉，改用内描边；禁止 iframe 内滚动
const PREVIEW_STYLE =
  '<style>html,body{background:transparent!important;overflow:hidden!important}#app{padding:0!important}' +
  '.sheet{box-shadow:none!important;outline:1px solid rgba(0,0,0,.08);outline-offset:-1px}</style>'

const stage = ref<HTMLElement>()
const frame = ref<HTMLIFrameElement>()
const srcdoc = ref('')
const failed = ref(false)
const stageW = ref(PAGE_W)
const stageH = ref(PAGE_H)
const contentHeight = ref(PAGE_H)
const pageCount = ref(1)
const expanded = ref(false)

const empty = computed(() => isResumeEmpty(props.resume))

/** 缩放方式记住上次选择；桌面预览默认「整页」先看到整体构图 */
const zoom = ref<PreviewZoom>(loadZoomPref() ?? (props.bounded ? 'page' : 'width'))
watch(zoom, saveZoomPref)

const scale = computed(() => {
  if (expanded.value) return 1
  const byWidth = stageW.value / PAGE_W
  if (zoom.value === 'actual') return 1
  if (zoom.value === 'page' && props.bounded) {
    return Math.max(MIN_SCALE, Math.min(byWidth, (stageH.value - 8) / contentHeight.value, 1))
  }
  return Math.min(1, byWidth)
})

let loadSeq = 0
async function loadTemplate(id: TemplateId): Promise<void> {
  const seq = ++loadSeq
  failed.value = false
  try {
    const tpl = await fetchTemplate(id)
    if (seq === loadSeq) srcdoc.value = injectData(tpl, renderPayload(props.resume, props.themeId), PREVIEW_STYLE)
  } catch {
    if (seq === loadSeq) failed.value = true
  }
}

function render(): void {
  const win = frame.value?.contentWindow as ShowmeWindow | null | undefined
  win?.__showme_render?.(renderPayload(props.resume, props.themeId))
  measure()
}

function measure(): void {
  const doc = frame.value?.contentDocument
  if (!doc) return
  contentHeight.value = Math.max(PAGE_H, Math.ceil(doc.documentElement.getBoundingClientRect().height))
  pageCount.value = Math.max(1, doc.querySelectorAll('.sheet').length)
}

let innerObserver: ResizeObserver | undefined
function onFrameLoad(): void {
  const win = frame.value?.contentWindow as (Window & typeof globalThis) | null | undefined
  const doc = frame.value?.contentDocument
  if (!win || !doc) return
  // srcdoc 生成后到载入完成之间数据可能又变了，载入后按最新数据重绘一次
  render()
  innerObserver?.disconnect()
  innerObserver = new win.ResizeObserver(measure)
  innerObserver.observe(doc.documentElement)
  measure()
}

watch(() => props.templateId, loadTemplate, { immediate: true })

let timer: ReturnType<typeof setTimeout> | undefined
// 内容或主题变化都只需重绘（主题是换 CSS 变量，无须重载模板文档）
watch(
  () => [props.resume, props.themeId],
  () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(render, RENDER_DELAY)
  },
  { deep: true },
)

let stageObserver: ResizeObserver | undefined
onMounted(() => {
  // 不可见时模板无法测量分页（窄屏切到别的标签页），重新可见后重绘一次
  let hidden = false
  let seen = false
  stageObserver = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect
    if (width <= 0) {
      hidden = true
      return
    }
    stageW.value = width
    if (height > 0) stageH.value = height
    if ((hidden || !seen) && !empty.value) {
      hidden = false
      seen = true
      render()
    }
  })
  stageObserver.observe(stage.value!)
})

function toggleExpand(): void {
  expanded.value = !expanded.value
}

function onExpandKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') expanded.value = false
}

watch(expanded, (v) => {
  if (v) {
    window.addEventListener('keydown', onExpandKey)
    document.body.style.overflow = 'hidden'
  } else {
    window.removeEventListener('keydown', onExpandKey)
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => {
  if (timer !== undefined) clearTimeout(timer)
  stageObserver?.disconnect()
  innerObserver?.disconnect()
  window.removeEventListener('keydown', onExpandKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="preview" :class="{ expanded, bounded }">
    <div ref="stage" class="stage">
      <div v-if="empty" class="preview-empty">
        <p class="preview-empty-title">简历还是空的</p>
        <p class="hint">在「编辑」里填写基本信息，内容会实时出现在这里。</p>
      </div>
      <div v-else-if="failed" class="preview-failed">
        <p>模板加载失败，请检查网络后重试。</p>
        <button class="btn" type="button" @click="loadTemplate(templateId)">重试</button>
      </div>
      <div v-else class="paper" :style="{ width: `${PAGE_W * scale}px`, height: `${contentHeight * scale}px` }">
        <iframe
          ref="frame"
          class="paper-frame"
          title="简历预览"
          :srcdoc="srcdoc"
          :style="{ width: `${PAGE_W}px`, height: `${contentHeight}px`, transform: `scale(${scale})` }"
          @load="onFrameLoad"
        />
      </div>
    </div>

    <footer v-if="!empty" class="bar">
      <span class="hint count">A4 · 共 {{ pageCount }} 页</span>
      <div v-if="!expanded" class="zoom" role="radiogroup" aria-label="预览缩放">
        <button
          v-for="z in PREVIEW_ZOOMS"
          :key="z"
          class="zoom-item"
          :class="{ active: zoom === z }"
          type="button"
          role="radio"
          :aria-checked="zoom === z"
          :tabindex="zoom === z ? 0 : -1"
          @click="zoom = z"
        >
          {{ ZOOM_LABELS[z] }}
        </button>
      </div>
      <button class="btn btn-plain zoom-toggle" type="button" @click="toggleExpand">
        <Icon :name="expanded ? 'close' : 'expand'" />{{ expanded ? '退出放大' : '放大' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.preview { display: flex; flex-direction: column; width: 100%; min-width: 0; }
.preview.bounded { height: 100%; min-height: 0; }
.stage { position: relative; }
.preview.bounded .stage {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable; /* 滚动条出现与否不改变宽度，避免缩放来回跳动 */
  scrollbar-width: thin;
}
/* flex: none 防止纸张被 flex 收缩；auto 边距在有余量时居中、溢出时归零以便滚动 */
.paper { flex: none; margin: 0 auto; overflow: hidden; }
.paper-frame {
  display: block;
  border: none;
  transform-origin: 0 0;
  pointer-events: none; /* 只读预览，滚动交给外层页面 */
}
.preview-empty,
.preview-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: none;
  margin: auto;
  padding: 32px 24px;
  color: var(--muted);
  text-align: center;
}
.preview-empty { max-width: 320px; border: 1.5px dashed var(--line); border-radius: var(--radius); }
.preview-empty-title { margin: 0; color: var(--ink); font-size: 15px; font-weight: 600; }
.preview-empty .hint,
.preview-failed p { margin: 0; }
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px 0;
}
.count { flex: 1; min-width: 0; }
.zoom {
  display: inline-flex;
  flex: none;
  padding: 2px;
  border-radius: 9px;
  background: var(--fill);
}
.zoom-item {
  min-height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.zoom-item.active {
  background: #fff;
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.08);
}
.zoom-toggle { flex: none; }
@media (max-width: 1099.98px) {
  .zoom-item { min-height: 44px; padding: 0 14px; font-size: 13px; }
}

/* 放大：整屏覆盖查看（100% 原尺寸，可平移滚动），DOM 不移动，iframe 不重载 */
.preview.expanded {
  position: fixed;
  inset: 0;
  z-index: 60;
  height: auto;
  padding: calc(10px + var(--safe-top)) calc(10px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(10px + var(--safe-left));
  background: var(--bg);
}
.preview.expanded .stage {
  display: block;
  flex: 1;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
