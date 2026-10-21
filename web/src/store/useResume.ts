import { computed, ref, watch } from 'vue'
import {
  account,
  completePasswordReset as applyPasswordReset,
  initAccount,
  signInAccount,
  signOutAccount,
  signUpAccount,
  updateDisplayName,
  type SessionInfo,
} from '../cloud/account'
import type { AuthCallback } from '../cloud/authCallback'
import { getClient } from '../cloud/client'
import {
  createSupabaseLibrary,
  DuplicateResumeNameError,
  EmptyResumeNameError,
  ResumeLibrary,
  type ResumeMeta,
  type StoredResume,
} from '../cloud/library'
import { normalizeResume, sameResume } from '../model/normalize'
import { emptyResume, type Resume } from '../model/resume'
import type { TemplateId } from '../templates/catalog'
import type { ThemeId } from '../templates/themes'
import { confirmDialog } from '../ui/confirm'
import { showToast } from '../ui/toast'
import { BUILD_TIME } from '../version'
import { loadLocalDocName, saveLocalDocName } from './localDoc'
import { loadOnboardedPref, loadTemplatePref, loadThemePref, saveOnboardedPref, saveTemplatePref, saveThemePref } from './prefs'
import { clearRecoveryDraft, readRecoveryDraft, writeRecoveryDraft, type RecoveryDraft } from './recovery'
import { cleanResumeName, suggestCopyName, suggestResumeName } from './resumeName'
import { LocalResumeStore, type LoadStatus } from './ResumeStore'
import { takeUpdateHandoff, writeUpdateHandoff, type UpdateHandoff } from './updateHandoff'

/**
 * 全局文档状态（唯一数据源）。
 *
 * 与上一版的区别：编辑只改内存中的工作副本，点「保存」才写入本机或云端。
 * 未登录 = 单份本地简历；已登录 = 云端多份简历库。
 */

const localStore = new LocalResumeStore()
const initial = localStore.load()
/** 「立即更新」写入的交接快照：启动时消费一次，覆盖本机已保存状态 */
const updateHandoff = takeUpdateHandoff()

/** 深拷贝一份规范化的基线，用于判断是否有未保存修改（必须与工作副本不共享引用） */
function snapshot(r: Resume): Resume {
  return normalizeResume(JSON.parse(JSON.stringify(r)))
}

const resume = ref<Resume>(updateHandoff ? updateHandoff.resume : normalizeResume(initial.resume))
const templateId = ref<TemplateId>(updateHandoff ? updateHandoff.templateId : loadTemplatePref())
const themeId = ref<ThemeId>(updateHandoff ? updateHandoff.themeId : loadThemePref())

/** 最近一次成功保存/打开时的内容基线 */
const baseline = ref<Resume>(updateHandoff ? snapshot(updateHandoff.baseline) : snapshot(resume.value))
const docName = ref(updateHandoff ? updateHandoff.docName : loadLocalDocName())
/** 云端文档 id；null 表示尚未入库（本地保存或新建草稿） */
const docId = ref<string | null>(updateHandoff?.docId ?? null)
const docUpdatedAt = ref<string | null>(updateHandoff?.docUpdatedAt ?? null)

const saving = ref(false)
const savedAt = ref<number | null>(updateHandoff?.savedAt ?? null)
const lastScope = ref<'local' | 'cloud' | ''>(updateHandoff?.lastScope ?? '')

const library = ref<ResumeMeta[]>([])
const libraryLoading = ref(false)
const libraryError = ref('')
const openingId = ref('')

/** 上次未保存的本地草稿；启动时读取一次，恢复或忽略后清空 */
const recoveryDraft = ref<RecoveryDraft | null>(readRecoveryDraft())
/** 首次进入：空白 / 示例二选一 */
const onboarding = ref(false)
/** 本次启动是否由「立即更新」触发的刷新；null 表示普通启动 */
const restoredFromBuild = ref<number | null>(updateHandoff?.fromBuildTime ?? null)

/** 邮件里的重置密码链接：打开全屏设置新密码；失败时保留错误原因 */
const recoveryActive = ref(false)
const recoveryError = ref('')

/** 有未保存修改：内容与基线不同 */
const dirty = computed(() => !sameResume(resume.value, baseline.value))

/** 打开保存弹层时的建议名称：排除当前文档自身，避免给自己加（2） */
const suggestedName = computed(() =>
  suggestResumeName(
    resume.value,
    library.value.filter((d) => d.id !== docId.value).map((d) => d.name),
  ),
)

let lib: ResumeLibrary | null = null
let libUserId = ''

async function getLibrary(): Promise<ResumeLibrary> {
  if (!account.ready) throw new Error('请先登录')
  if (lib && libUserId === account.userId) return lib
  const client = await getClient()
  lib = new ResumeLibrary(createSupabaseLibrary(client, account.userId))
  libUserId = account.userId
  return lib
}

function resetLibraryState(): void {
  lib = null
  libUserId = ''
  library.value = []
  libraryError.value = ''
  libraryLoading.value = false
  openingId.value = ''
}

async function refreshLibrary(): Promise<void> {
  if (!account.ready) {
    library.value = []
    libraryError.value = ''
    return
  }
  libraryLoading.value = true
  libraryError.value = ''
  try {
    library.value = await (await getLibrary()).list()
  } catch (e) {
    libraryError.value = libraryErrorMessage(e)
  } finally {
    libraryLoading.value = false
  }
}

function isChinese(s: string): boolean {
  return /[\u3400-\u9fff]/.test(s)
}

function saveErrorMessage(e: unknown): string {
  if (e instanceof DuplicateResumeNameError) return '简历库中已有同名简历，请换一个名称'
  if (e instanceof EmptyResumeNameError) return '请输入简历名称'
  if (e instanceof Error) {
    if (isChinese(e.message)) return e.message
    if (/fetch|network|timeout|offline/i.test(e.message)) return '网络异常，保存失败，请检查网络后重试'
    if (/(jwt|token|auth|401|403)/i.test(e.message)) return '登录状态已失效，请重新登录后再保存'
  }
  return '保存失败，请稍后重试'
}

function libraryErrorMessage(e: unknown): string {
  if (e instanceof Error && isChinese(e.message)) return e.message
  const message = (e as { message?: unknown } | null)?.message
  if (typeof message === 'string' && /fetch|network|timeout|offline/i.test(message)) {
    return '网络异常，请检查网络后重试'
  }
  return '操作失败，请稍后重试'
}

function confirmDiscard(action: string): Promise<boolean> {
  if (!dirty.value) return Promise.resolve(true)
  return confirmDialog({
    title: '有未保存的修改',
    message: `当前修改尚未保存，${action}后这些修改会丢失。`,
    confirmText: '放弃修改',
    cancelText: '继续编辑',
    danger: true,
  })
}

/** 清除本地恢复草稿（保存成功、登录、新建、打开、导入时调用） */
function dropRecoveryDraft(): void {
  window.clearTimeout(recoveryTimer)
  recoveryDraft.value = null
  clearRecoveryDraft()
}

function flushRecoveryDraft(): void {
  if (updateReloading || account.ready || !dirty.value) return
  writeRecoveryDraft({
    resume: resume.value,
    templateId: templateId.value,
    themeId: themeId.value,
    docName: docName.value,
    at: Date.now(),
  })
}

let recoveryTimer: number | undefined
/** 「立即更新」触发的刷新进行中：不再写草稿，也不再弹 beforeunload */
let updateReloading = false

/**
 * 更新前把完整编辑状态写入 sessionStorage；返回 false 时调用方必须中止刷新。
 * 有未保存修改时清掉旧草稿（快照已包含最新内容）；只有草稿而当前干净时保留草稿，
 * 让刷新后仍能看到原来的恢复提示。
 */
export function prepareForUpdateReload(): boolean {
  if (updateReloading) return true
  try {
    const handoff: UpdateHandoff = {
      resume: normalizeResume(resume.value),
      baseline: snapshot(baseline.value),
      templateId: templateId.value,
      themeId: themeId.value,
      docName: docName.value,
      docId: docId.value,
      docUpdatedAt: docUpdatedAt.value,
      savedAt: savedAt.value,
      lastScope: lastScope.value,
      fromBuildTime: BUILD_TIME,
      at: Date.now(),
    }
    if (!writeUpdateHandoff(handoff)) return false
    if (dirty.value) dropRecoveryDraft()
    else window.clearTimeout(recoveryTimer)
    updateReloading = true
    return true
  } catch {
    return false
  }
}

/** 恢复上次未保存的草稿：作为未保存内容载入，不覆盖已保存版本 */
export function restoreRecovery(): void {
  const draft = recoveryDraft.value
  if (!draft) return
  resume.value = normalizeResume(draft.resume)
  templateId.value = draft.templateId
  themeId.value = draft.themeId
  docName.value = draft.docName
  docId.value = null
  docUpdatedAt.value = null
  savedAt.value = null
  lastScope.value = ''
  // 基线保持不变：恢复内容仍显示为「未保存」，由用户确认后手动保存
  dropRecoveryDraft()
  showToast('已恢复上次未保存的修改，确认后请点击「保存」', 'success', 5000)
}

export function dismissRecovery(): void {
  dropRecoveryDraft()
}

function applyLoadedDoc(stored: StoredResume): void {
  const normalized = normalizeResume(stored.data)
  resume.value = normalized
  baseline.value = snapshot(normalized)
  docId.value = stored.meta.id
  docName.value = stored.meta.name
  docUpdatedAt.value = stored.meta.updatedAt
  const at = Date.parse(stored.meta.updatedAt)
  savedAt.value = Number.isFinite(at) ? at : Date.now()
  lastScope.value = 'cloud'
  dropRecoveryDraft()
}

export interface SaveOutcome {
  scope: 'local' | 'cloud'
  name: string
}

/** 保存当前工作副本；名称留空时用建议名。失败抛出可直接展示的中文错误 */
export async function saveCurrent(rawName = ''): Promise<SaveOutcome> {
  if (saving.value) throw new Error('正在保存，请稍候')
  const name = cleanResumeName(rawName) || suggestedName.value
  saving.value = true
  try {
    const data = normalizeResume(resume.value)

    if (!account.ready) {
      if (!localStore.save(data)) throw new Error('浏览器存储不可用，请先导出 JSON 备份')
      saveLocalDocName(name)
      docName.value = name
      docId.value = null
      docUpdatedAt.value = null
      baseline.value = snapshot(data)
      savedAt.value = Date.now()
      lastScope.value = 'local'
      dropRecoveryDraft()
      return { scope: 'local', name }
    }

    const cloud = await getLibrary()
    const meta = docId.value ? await cloud.save(docId.value, name, data) : await cloud.create(name, data)
    docId.value = meta.id
    docName.value = meta.name
    docUpdatedAt.value = meta.updatedAt
    baseline.value = snapshot(data)
    const at = Date.parse(meta.updatedAt)
    savedAt.value = Number.isFinite(at) ? at : Date.now()
    lastScope.value = 'cloud'
    dropRecoveryDraft()
    await refreshLibrary()
    return { scope: 'cloud', name: meta.name }
  } catch (e) {
    throw new Error(saveErrorMessage(e))
  } finally {
    saving.value = false
  }
}

/** 打开简历库中的一份；当前有未保存修改时先确认 */
export async function openDocFromLibrary(id: string): Promise<boolean> {
  if (id === docId.value) {
    showToast('当前正在编辑这份简历')
    return true
  }
  if (!(await confirmDiscard('打开其他简历'))) return false
  openingId.value = id
  try {
    const stored = await (await getLibrary()).get(id)
    applyLoadedDoc(stored)
    showToast(`已打开「${stored.meta.name}」`, 'success')
    return true
  } catch (e) {
    showToast(`打开失败：${libraryErrorMessage(e)}`, 'error', 5000)
    return false
  } finally {
    openingId.value = ''
  }
}

/** 新建空白简历；有未保存修改时先确认 */
export async function createNewDocument(): Promise<boolean> {
  if (!(await confirmDiscard('新建简历'))) return false
  const blank = emptyResume()
  resume.value = blank
  baseline.value = snapshot(blank)
  docId.value = null
  docName.value = ''
  docUpdatedAt.value = null
  savedAt.value = null
  lastScope.value = ''
  dropRecoveryDraft()
  return true
}

/** 从简历库删除；若删除的是当前文档，编辑内容保留为未保存草稿 */
export async function deleteLibraryDoc(meta: ResumeMeta): Promise<boolean> {
  const isCurrent = meta.id === docId.value
  const ok = await confirmDialog({
    title: '删除简历',
    message: `确定从简历库删除「${meta.name}」吗？删除后无法恢复。${isCurrent ? '当前编辑内容会保留为未保存草稿。' : ''}`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return false
  try {
    await (await getLibrary()).remove(meta.id)
    if (isCurrent) {
      docId.value = null
      docUpdatedAt.value = null
      savedAt.value = null
      lastScope.value = ''
      // 云端条目已删除：以本机缓存为基线，让保存状态如实显示为未保存草稿
      baseline.value = snapshot(localStore.load().resume)
    }
    await refreshLibrary()
    showToast(isCurrent ? '已删除；当前内容保留为未保存草稿' : '已从简历库删除', 'success')
    return true
  } catch (e) {
    showToast(`删除失败：${libraryErrorMessage(e)}`, 'error', 5000)
    return false
  }
}

/** 复制一份云端简历：不切换当前编辑；名称按「（副本）」规则去重 */
export async function duplicateLibraryDoc(meta: ResumeMeta): Promise<boolean> {
  try {
    const stored = await (await getLibrary()).get(meta.id)
    const name = suggestCopyName(meta.name, library.value.map((doc) => doc.name))
    await (await getLibrary()).create(name, stored.data)
    await refreshLibrary()
    showToast(`已创建「${name}」`, 'success')
    return true
  } catch (e) {
    showToast(`复制失败：${libraryErrorMessage(e)}`, 'error', 5000)
    return false
  }
}

/**
 * 登录后的衔接：
 * - silent：页面启动恢复会话，不打扰用户；
 * - loadLatest：当前没有未保存修改时，自动打开最近更新的云端简历。
 */
async function synchronizeAfterLogin(loadLatest: boolean, silent = false): Promise<void> {
  dropRecoveryDraft()
  resetLibraryState()
  await refreshLibrary()
  if (libraryError.value) {
    if (!silent) showToast(`已登录，但简历库读取失败：${libraryError.value}`, 'error', 5000)
    return
  }
  if (!loadLatest) {
    if (!silent) showToast('已登录。当前有未保存的修改，已为你保留', 'info', 4000)
    return
  }
  if (library.value.length === 0) {
    if (!silent) showToast('已登录。点击「保存」可将当前简历加入云端简历库', 'info', 4500)
    return
  }
  const latest = library.value[0]!
  try {
    const stored = await (await getLibrary()).get(latest.id)
    applyLoadedDoc(stored)
    if (!silent) showToast(`已打开最近编辑的「${stored.meta.name}」`, 'success', 4000)
  } catch (e) {
    showToast(`最近一份简历读取失败：${libraryErrorMessage(e)}`, 'error', 5000)
  }
}

export async function login(email: string, password: string): Promise<void> {
  await signInAccount(email, password)
  await synchronizeAfterLogin(!dirty.value)
}

export async function register(email: string, password: string): Promise<void> {
  await signUpAccount(email, password)
  await synchronizeAfterLogin(!dirty.value)
}

export async function logout(): Promise<void> {
  if (dirty.value) {
    const ok = await confirmDialog({
      title: '退出登录',
      message: '当前有未保存的修改。退出后仍可继续编辑并保存到本机，确定退出？',
      confirmText: '退出登录',
    })
    if (!ok) return
  }
  const wasCloudDoc = docId.value !== null
  await signOutAccount()
  resetLibraryState()
  docId.value = null
  docUpdatedAt.value = null
  if (wasCloudDoc) {
    // 云端内容没有写入本机缓存：以本地已保存内容为基线，让界面如实提示「未保存」
    baseline.value = snapshot(localStore.load().resume)
  }
  showToast(
    dirty.value ? '已退出登录；当前内容尚未保存到本机，需要保留请点击「保存」' : '已退出登录',
    'info',
    4500,
  )
}

/** 保存账号昵称（个人资料） */
export async function saveProfileName(rawName: string): Promise<void> {
  try {
    await updateDisplayName(rawName)
  } catch (e) {
    const message = e instanceof Error && isChinese(e.message) ? e.message : '资料保存失败，请稍后重试'
    throw new Error(message)
  }
}

function handleAuthCallback(callback: AuthCallback, session: SessionInfo | null): void {
  if (callback.kind === 'recovery') {
    recoveryActive.value = true
    if (!session) recoveryError.value = '链接已失效'
  } else if (callback.kind === 'error' && callback.flow === 'recovery') {
    recoveryActive.value = true
    recoveryError.value = callback.description
  } else if (callback.kind === 'email_change') {
    showToast(session ? '邮箱已更新' : '邮箱变更已确认，请重新登录', 'success', 4500)
  } else if (callback.kind === 'error' && callback.flow === 'email-change') {
    showToast(`邮箱更换失败：${callback.description}`, 'error', 6000)
  } else if (callback.kind === 'error') {
    // 流程标记也丢了（旧版回调地址会这样）：至少明确告知，不静默落进编辑页
    showToast('邮件链接已失效，请回到账号页重新发起', 'error', 6000)
  }
}

/** 在找回会话里设置新密码 */
export async function submitNewPassword(password: string): Promise<void> {
  await applyPasswordReset(password)
  recoveryActive.value = false
  recoveryError.value = ''
  showToast('密码已更新，其他设备需要重新登录', 'success', 5000)
}

/** 关闭找回面板（链接失效时用户也可以先去登录） */
export function finishRecovery(): void {
  recoveryActive.value = false
  recoveryError.value = ''
}

/** 导入 / 接力导入 / 收到简历时替换工作副本：作为新的未保存文档，避免覆盖库内已有条目 */
export function replaceResume(next: Resume): void {
  resume.value = normalizeResume(next)
  docId.value = null
  docName.value = ''
  docUpdatedAt.value = null
  savedAt.value = null
  lastScope.value = ''
  dropRecoveryDraft()
}

/** 首次进入：本地为空、没有会话、没有恢复草稿时，询问从空白还是示例开始 */
export async function maybeOfferOnboarding(): Promise<void> {
  await sessionReady
  // 更新刷新回来的内容一定不是「首次进入」，不再打扰
  if (restoredFromBuild.value !== null) return
  if (onboarding.value || recoveryActive.value) return
  // 有未处理草稿时先不打扰，也不记为已引导，等草稿处理完再出现
  if (recoveryDraft.value) return
  if (loadOnboardedPref() || initial.status !== 'empty' || account.ready) {
    saveOnboardedPref()
    return
  }
  onboarding.value = true
}

export function finishOnboarding(startBlank: boolean): void {
  if (!onboarding.value) return
  onboarding.value = false
  saveOnboardedPref()
  if (!startBlank) return
  void createNewDocument().then((ok) => {
    if (ok) showToast('已新建空白简历，填写后记得保存', 'info', 3500)
  })
}

let sessionReady: Promise<void> = Promise.resolve()

watch(templateId, saveTemplatePref)
watch(themeId, saveThemePref)

if (typeof window !== 'undefined') {
  // 显式保存模式：有未保存修改时离开页面给出浏览器原生确认
  window.addEventListener('beforeunload', (event) => {
    if (updateReloading || !dirty.value) return
    flushRecoveryDraft()
    event.preventDefault()
    event.returnValue = ''
  })

  // 未登录且有未保存修改时，节流写一份本地恢复草稿
  watch(
    [resume, templateId, themeId],
    () => {
      if (updateReloading || account.ready || !dirty.value) return
      window.clearTimeout(recoveryTimer)
      recoveryTimer = window.setTimeout(flushRecoveryDraft, 800)
    },
    { deep: true },
  )

  // 启动时恢复已登录会话；已有云端简历则打开最近更新的一份
  if (account.available) {
    sessionReady = (async () => {
      const { session, callback } = await initAccount()
      handleAuthCallback(callback, session)
      // 更新刷新回来的工作副本优先，不能再用云端最近一份覆盖
      if (session) await synchronizeAfterLogin(restoredFromBuild.value === null, true)
    })()
  }
}

export function useResume() {
  return {
    resume,
    templateId,
    themeId,
    account,
    dirty,
    saving,
    savedAt,
    lastScope,
    docId,
    docName,
    docUpdatedAt,
    library,
    libraryLoading,
    libraryError,
    openingId,
    suggestedName,
    initialStatus: initial.status as LoadStatus,
    saveCurrent,
    openDocFromLibrary,
    createNewDocument,
    deleteLibraryDoc,
    duplicateLibraryDoc,
    refreshLibrary,
    login,
    register,
    logout,
    saveProfileName,
    recoveryActive,
    recoveryError,
    submitNewPassword,
    finishRecovery,
    replaceResume,
    recoveryDraft,
    restoreRecovery,
    dismissRecovery,
    prepareForUpdateReload,
    restoredFromBuild,
    onboarding,
    maybeOfferOnboarding,
    finishOnboarding,
  }
}
