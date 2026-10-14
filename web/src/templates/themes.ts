/** 内置主题目录：排版（模板）与主题解耦，一份排版可搭配任意主题。
 *  主题的真实视觉是一组 CSS 变量覆盖，统一定义在 templates/runtime.css 的 html[data-theme=…] 规则里；
 *  accent / paper / band 供界面上的迷你简历卡展示（与 runtime.css 的视觉保持一致：
 *  accent=强调色，paper=纸面主色调，band=纸顶装饰条颜色，plain 无装饰条）。 */
export const THEMES = [
  { id: 'plain', name: '清爽', accent: '#0071e3', paper: '#ffffff', band: '' },
  { id: 'graphite', name: '石墨', accent: '#2b2b30', paper: '#f4f4f6', band: '#2b2b30' },
  { id: 'warm', name: '暖阳', accent: '#c46a2b', paper: '#f8f0e0', band: 'linear-gradient(90deg,#e0913d,#f0c285)' },
  { id: 'mint', name: '薄荷', accent: '#0fa88f', paper: '#f0f9f5', band: 'linear-gradient(90deg,#0fa88f,#83d9c6)' },
  { id: 'dusk', name: '暮蓝', accent: '#2f5da8', paper: '#ecf2fa', band: '#2f5da8' },
  { id: 'violet', name: '紫雾', accent: '#7a5af5', paper: '#f4f1fd', band: 'linear-gradient(90deg,#7a5af5,#b3a2fa)' },
  { id: 'rose', name: '蔷薇', accent: '#d24f78', paper: '#faf0f4', band: 'linear-gradient(90deg,#d24f78,#efa9c1)' },
  { id: 'forest', name: '森语', accent: '#2e7d5f', paper: '#edf5f0', band: '#2e7d5f' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'plain'

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id)

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v)
}
