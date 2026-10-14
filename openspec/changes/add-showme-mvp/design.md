# 设计：ShowMe MVP（add-showme-mvp）

## Context

全新仓库，无既有代码。目标是一次性交付可侧载运行的 Android 应用：本地简历编辑 + 模板预览 + PDF 导出 + 局域网「电脑接力」。约束：无自有服务器、无云服务账号、不申请敏感权限、交互对标 iOS 设计气质。MVP 后的演进方向（云同步、在线短链）不在本变更内，但架构需不堵死。

## Goals / Non-Goals

**Goals:**

- 手机上 5 分钟内建出一份像样的简历（预填示例 + 块式编辑）。
- 3 套模板实时预览与一键 PDF 导出。
- 同一 Wi-Fi 下 PC 扫码即可查看简历、表单编辑并保存回手机；PC 端可直接浏览器打印。
- 零云依赖、零敏感权限、数据完全本机。

**Non-Goals:**

- 云同步、持久在线短链/二维码、账号体系、多简历管理。
- iOS/桌面端、简历分身、AI 润色、头像图片上传、相机扫码。
- 拖拽排序（用上移/下移按钮替代）、国际化（仅中文 UI）。

## Decisions

### D1 技术栈：Kotlin + Jetpack Compose（非 Flutter/RN）

- 理由：单 Android MVP，Compose 对 iOS 风动效与大标题导航还原度最高；无跨端诉求。PC 端本就是独立 H5，两端共享的是**数据模型 + 模板**而非 UI 代码，强行跨端统一无收益。
- 备选：Flutter（为将来 iOS 留路）——被否：MVP 阶段引入双倍工程复杂度，iOS 需求出现时再评估。

### D2 模板即 HTML+CSS+内联 JS 渲染器（一次编写，三处复用）

```
resume.json ──▶ templates/*.html（骨架+CSS+render(data) JS）
                 ├── App 预览：WebView + evaluateJavascript 注入 JSON
                 ├── PC 接力：assets/web/index.html 加载后 fetch /api/resume 调同一 render
                 └── PDF：预览 WebView 直接走系统打印（@media print 样式内置于模板）
```

- 理由：消灭"多端渲染不一致"，PDF 导出零成本（模板即打印样式），未来 H5 可原样托管到静态平台成为真正的在线链接（通往 M1 的路）。
- 备选：原生 Canvas 自绘模板——被否：每套模板双端各写一遍，PDF 还需第三套实现。

### D3 持久化：单文件 JSON + kotlinx-serialization（非 Room/DataStore）

- `filesDir/resume.json`，编辑变更 500ms 防抖后落盘；启动时加载，损坏时回退默认示例。
- 理由：单用户、单文档、低频写，天然嵌套的文档型结构用 JSON 最直接；Room 的 schema/DAO 成本为负收益。`version` 字段预留迁移。
- 数据模型（v1）：`basics{name,title,phone,email,city,summary}` + `education[]` + `work[]`（含 `highlights[]`）+ `projects[]` + `skills[]`（分组标签）。

### D4 电脑接力：内嵌 NanoHTTPD + ZXing 二维码 + 令牌校验

- 服务监听 `0.0.0.0:<随机端口>`，地址通过 `NetworkInterface` 枚举 IPv4 获得（免 ACCESS_WIFI_STATE/LOCATION 权限）。
- 端点：`GET /` → H5 单页；`GET /api/resume` → 简历 JSON；`POST /api/resume?token=<t>` → 校验令牌后落盘并回推状态。
- 二维码内容 `http://<lan-ip>:<port>/?t=<token>`；无 token 访问为只读模式（查看+浏览器打印），带 token 解锁表单编辑。token 每次启动服务随机生成。
- 生命周期：仅在「电脑」页运行，离开页面即停止（避免前台服务/通知权限复杂度），页面文案明示"保持本页打开"。
- 备选：云 BaaS——被否：需账号与备案且 MVP 不该背外部依赖；Wi-Fi 直连二维码——被否：断网场景收益低、复杂度高。

### D5 PDF 导出：系统打印框架（PrintManager + WebView Adapter）

- 预览页按钮直接打印当前 WebView（`createPrintDocumentAdapter`），用户在系统面板选"另存为 PDF"。
- 理由：零依赖、系统级稳定；隐藏打印 UI 由模板 `@media print` 承担，条目卡片 `break-inside: avoid` 防截断。
- 备选：离屏 WebView 渲染 + PdfDocument 自绘——被否：时序脆弱、中文分页坑多。

### D6 UI 基调：Material3 之上做 iOS 气质定制

- 底色 `#F2F2F7`（iOS grouped background）、白卡片 16dp 圆角、点缀蓝 `#0A84FF`、大标题排版、细分割线；底部导航三页：编辑 / 预览 / 电脑。
- 编辑器 = 分节卡片列表（收起/展开），条目操作用图标按钮（增/删/上移/下移），所有输入即时进 State 并触发防抖保存。

### D7 WebView 与 App 的通信：单向注入，不走 JS Bridge

- App 侧 `evaluateJavascript("window.__showme_render(<json>)")` 渲染；PC 侧 HTTP fetch。H5 编辑保存走 HTTP POST 而非 Bridge——保证 H5 将来可直接托管上线（服务端换成云函数即可），App 与 H5 完全解耦。

## Risks / Trade-offs

- [路由器 AP 隔离/企业网导致 PC 连不上手机] → 界面显示完整 URL 供手输核对；文案提示"手机与电脑需在同一 Wi-Fi"；后续可加热点模式。
- [Android 9+ 默认禁止明文 HTTP] → `usesCleartextTraffic=true`（仅服务本机局域网地址，自用可接受）。
- [打印分页截断条目] → 模板内置 `@media print`：隐藏操作元素、`break-inside: avoid`、A4 边距。
- [端口被占用] → 启动时从随机端口起重试若干次。
- [多网卡/多 IP（蜂窝同时开启）] → 枚举所有 IPv4 站点内网地址，QR 采用第一个可用地址，界面列出备选地址。
- [离开「电脑」页服务停止导致 PC 会话中断] → 页面文案明示；这是 MVP 换取免前台服务权限的取舍。
- [无自动化测试环境（沙箱无 Android SDK）] → H5/模板为纯静态逻辑可本地验证；Kotlin 侧以编译通过为底线，真机验证清单写入 tasks.md 由用户执行。

## Migration Plan

全新工程，无迁移。回滚 = 删除新增目录/文件（Gradle 工程 + openspec/changes/add-showme-mvp）。

## Open Questions

- M1 云接力的 BaaS 选型（EdgeOne Pages vs Cloudflare vs Supabase）留待 spike；本设计 D2/D7 已保证 H5 与模板可直接复用上云。
- 应用名 ShowMe 为暂定，品牌命名不阻塞实现。
