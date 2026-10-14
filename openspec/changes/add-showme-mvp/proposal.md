# 提案：ShowMe 简历 App 最低可用版本（add-showme-mvp）

## Why

用户希望在手机上快速创建和编辑个人求职简历，并能通过链接/二维码在 PC 端查看、编辑同一份简历，但**没有自己的服务器**。市场上现有简历工具要么绑定云服务账号，要么仅出 PDF 无法二次编辑。本变更交付一个完全离线自持、零云依赖的 Android 应用 ShowMe：本地编辑简历，并通过「局域网电脑接力」实现 PC 浏览器扫码查看与编辑，验证核心产品体验。

## What Changes

- 新建 Android 工程（Kotlin + Jetpack Compose），位于仓库根目录。
- 简历数据模型（基本信息/教育/工作/项目/技能/自我评价）+ 本地 JSON 自动持久化。
- 块式编辑器：分节卡片、条目增删与上下移动，iOS 风格视觉（大标题、分组卡片、圆角、淡阴影）。
- 3 套 HTML/CSS 简历模板，WebView 实时预览，模板即 HTML（与 PC 端共用渲染逻辑）。
- PDF 导出：基于系统打印框架（另存为 PDF），复用模板渲染结果。
- 局域网电脑接力：手机内嵌 HTTP 服务 + 二维码（含地址与编辑令牌），PC 扫码或输入地址后可在浏览器查看简历、表单编辑并保存回手机；PC 端亦可直接浏览器打印为 PDF。
- 明确 Non-goals：云同步/在线短链、账号体系、iOS、简历分身、AI 润色、相机扫码、拖拽排序。

## Capabilities

### New Capabilities

- `resume-model`：简历数据模型与本地持久化（JSON Schema、自动保存、单文件存储）。
- `resume-editor`：块式简历编辑器（分节编辑、条目管理、输入即时生效）。
- `resume-templates`：模板渲染与实时预览（3 套模板、模板切换、所见即所得）。
- `pdf-export`：PDF 导出（系统打印框架、分页打印样式）。
- `lan-relay`：局域网电脑接力（内嵌 HTTP 服务、二维码/地址分享、PC 查看/表单编辑/保存回传、浏览器打印）。

### Modified Capabilities

（无 —— 全新项目，无既有能力。）

## Impact

- 新增代码：仓库根目录 Android 工程（`app/` 模块，package `com.showme.app`）。
- 新增资产：`app/src/main/assets/templates/`（3 套模板）、`app/src/main/assets/web/`（PC 端 H5 单页应用，与模板共用渲染逻辑）。
- 依赖：Compose BOM / Material3、kotlinx-serialization-json、NanoHTTPD（内嵌 HTTP 服务）、ZXing core（二维码生成）。
- 权限：仅网络接口枚举与本机回环，不需要 CAMERA/LOCATION；局域网服务仅监听本机，编辑需令牌校验。
- 无云端、无后端、无账号体系；不影响仓库内既有 OpenSpec 流程文件。
