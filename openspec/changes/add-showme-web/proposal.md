# 提案：ShowMe 简历响应式网页版第一版（add-showme-web）

## Why

Android 版（add-showme-mvp）需要用户本机安装 Android SDK 才能构建与验证，用户明确不想搭建移动开发环境。改为**响应式网页平台**：同一套页面自动适配手机与 PC，手机可"添加到主屏幕"像 App 一样使用，仅需 Node 即可开发、浏览器即可验证，免费静态托管即可上线。用户仍无自有服务器，因此第一版采用纯前端、零账号、零后端方案，并为后续接入免费云存储（云同步/在线分享）预留扩展点。

## What Changes

- 新建网页工程（Vite + Vue 3 + TypeScript），位于仓库 `web/` 目录；Android 工程（`app/`、Gradle 文件、add-showme-mvp 变更）保持不动。
- 简历数据存储于浏览器本地，自动保存；支持 JSON 文件导入/导出作为备份与迁移，数据结构与 Android 版 `Resume` JSON 完全兼容。
- 块式编辑器：六个分节（基本信息、教育、工作、项目、技能、自我评价），条目增删与上下移动，输入即时生效。
- 三套 HTML 模板（简雅/清朗/双栏）迁入 `web/templates/` 由网页版独立维护（不再与 Android 版共用）；模板按 A4 自动分页，预览与打印共用同一份分页结果；浏览器打印导出 A4 PDF。
- 长文本字段（自我评价、项目描述、工作描述、教育说明）保留换行：回车换行、空行分段、以「-」「•」开头的行显示为圆点列表；工作经历新增「工作描述」字段。
- 响应式布局：手机为单栏 + 底部「编辑 / 预览 / 分享」标签切换；PC 为左编辑、右实时预览双栏；整体沿用 iOS 风视觉。
- PWA：可安装到手机主屏幕，离线可用。
- 跨设备接力：
  - 主路径「短码分享」：简历在浏览器端加密后上传到 Cloudflare Pages Functions + KV 的中转接口，换取短码；二维码与链接只含短码和解密密钥（密钥在 `#` 之后，服务器只存密文），7 天后过期。
  - 备用「离线长链接」：简历压缩后整份放入链接 hash，无需任何服务，仅用于复制发送，不再生成二维码。
  - 另一设备打开链接即可查看，并可确认后导入为本机简历继续编辑，改完以同样方式传回。
- 明确 Non-goals：云同步（多端实时一致）、账号体系、多份简历管理、AI 润色、拖拽排序、头像照片、深色模式。

## Capabilities

### New Capabilities

- `web-resume-store`：简历数据本地持久化（自动保存、损坏回退示例、JSON 导入导出、与 Android 版数据兼容）。
- `web-resume-editor`：块式简历编辑器（分节编辑、条目管理、多行列表输入、输入即时生效）。
- `web-resume-preview`：模板实时预览与 PDF 导出（三套共用模板、模板切换与记忆、浏览器打印 A4）。
- `web-responsive-shell`：响应式应用外壳（手机单栏标签页 / PC 双栏、iOS 风视觉、PWA 安装与离线）。
- `web-link-relay`：跨设备接力（加密短码中转 + 二维码、离线长链接备用、复制/系统分享、接收端只读查看与确认导入）。

### Modified Capabilities

（无 —— `openspec/specs/` 下暂无已归档能力；Android 版能力保留在 add-showme-mvp 变更中，不受影响。）

## Impact

- 新增代码：`web/`（独立 npm 工程；构建产物 `web/dist/` 为静态文件，`web/functions/` 为 Cloudflare Pages Functions 中转接口）。
- 模板：`web/templates/` 为网页版模板唯一来源，Android 工程中的旧模板不再被引用。
- 新增依赖（npm）：vue、vite、@vitejs/plugin-vue、typescript、vue-tsc、lz-string（链接数据压缩）、qrcode（二维码生成）、vite-plugin-pwa（PWA）、vitest（单元测试）。
- 无账号；唯一的服务端是短码中转（只存加密后的快照、7 天过期），部署到 Cloudflare 需要用户的免费账号。简历本体仍只存于用户浏览器，清除浏览器数据会丢失，需提示用户导出备份。
- 不修改 Android 工程任何文件；`.gitignore` 增加 `web/node_modules/`、`web/dist/`。
