import { ref, watch } from 'vue'
import type { Resume } from '../model/resume'
import type { TemplateId } from '../templates/catalog'
import type { ThemeId } from '../templates/themes'
import { loadTemplatePref, loadThemePref, saveTemplatePref, saveThemePref } from './prefs'
import { LocalResumeStore, type LoadStatus, type ResumeStore } from './ResumeStore'

const AUTOSAVE_DELAY = 300

const store: ResumeStore = new LocalResumeStore()
const initial = store.load()

/** 全局唯一的当前简历状态 */
const resume = ref<Resume>(initial.resume)
const templateId = ref<TemplateId>(loadTemplatePref())
const themeId = ref<ThemeId>(loadThemePref())

/** 保存状态：供界面显示「保存中… / 已保存 HH:mm」 */
const saving = ref(false)
const savedAt = ref<number | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
let dirty = false

function flush(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  if (!dirty) return
  dirty = false
  saving.value = false
  if (store.save(resume.value)) savedAt.value = Date.now()
}

watch(
  resume,
  () => {
    dirty = true
    saving.value = true
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, AUTOSAVE_DELAY)
  },
  { deep: true },
)

watch(templateId, saveTemplatePref)
watch(themeId, saveThemePref)

// 防抖窗口内关闭/切走页面时立即落盘
window.addEventListener('pagehide', flush)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush()
})

export function useResume() {
  return {
    resume,
    templateId,
    themeId,
    saving,
    savedAt,
    initialStatus: initial.status as LoadStatus,
    /** 整体替换当前简历（导入 JSON / 导入接力简历），并立即保存 */
    replaceResume(next: Resume) {
      resume.value = next
      dirty = true
      saving.value = true
      flush()
    },
  }
}
