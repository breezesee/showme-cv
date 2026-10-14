# 设计：ShowMe 简历响应式网页版第一版

## Context

- 已有成果：add-showme-mvp（Android 版）中的三套简历模板 `app/src/main/assets/templates/{classic,air,duo}.html` 已遵循 `window.__showme_render(data)` 契约，并在 Chrome 中验证过渲染、空分节省略、XSS 转义与 A4 打印样式；PC 接力 H5 也验证过 iframe srcdoc 注入方式。
- 约束：用户无自有服务器、不愿安装移动开发环境；本机可用 Node v22。无账号；服务端仅限 Cloudflare 免费额度内的短码中转（见 D12）。
- 用户反馈（第一版走查后）：长文本换行不显示；内容超过一页时无分页、打印效果差；整份简历放进二维码太密、扫不出。用户同时明确不再维护 Android 版。
- 目标设备：手机浏览器（iOS Safari / Android Chrome，含"添加到主屏幕"）与 PC 桌面浏览器。
- 数据结构沿用 Android 版 `Resume` JSON（version=1：basics / education / work / projects / skills），两端数据可互相导入。

## Goals / Non-Goals

**Goals:**
- 一套代码同时适配手机与 PC：手机单栏标签页，PC 编辑与预览并排。
- 编辑即时生效、自动保存、刷新不丢数据；可导出/导入 JSON 备份。
- 长文本保留换行；内容超过一页时自动分页，预览与打印所见即所得。
- 跨设备接力：二维码只携带短码，任何长度的简历都能扫码传递；保留无服务的长链接作为备用。
- 存储层留出接口，后续接入云同步时不改动编辑器与预览。

**Non-Goals:**
- 云同步（多端实时一致）、账号体系。
- 多份简历管理、AI 润色、拖拽排序、头像、深色模式。
- 代替用户执行 Cloudflare 账号注册与上线部署（本变更提供配置与步骤说明，并在本地模拟中转接口完成验证）。

## Decisions

### D1：Vite + Vue 3 + TypeScript
- 理由：编辑器是"表单 ↔ 状态"双向绑定的典型场景，Vue 的响应式与 `v-model` 天然消除"手写字符串拼表单、漏写 value"这类缺陷（Android 版 H5 曾出现过）；TS 为简历数据结构提供编译期约束；Vite 构建产物为纯静态文件。
- 备选：沿用原生 JS（`assets/web/index.html` 的拼接写法）——编辑器复杂度上升后难维护，否决；React——同样可行，但 Vue 单文件组件更轻、模板写法更贴近 HTML，选 Vue。

### D2：模板归网页版所有，放在 `web/templates/`
- 三套模板 `classic|air|duo.html` 与共享运行时 `runtime.js` / `runtime.css` 放在 `web/templates/`。vite 插件在开发时提供 `/templates/<id>.html`、构建时输出到 `dist/templates/`，两种情况下都把模板中的 `<!--showme:runtime-->` 标记替换为内联的运行时，使每个模板产物都是自包含的单文件（srcdoc 与打印页均无需解析相对路径）。
- 理由：用户已弃用 Android 版；分页与多行文本需要三套模板共用同一套逻辑，放进运行时只写一次。Android 工程中的旧模板保持原状、不再被引用。
- 备选：继续引用 `app/src/main/assets/templates/`——会把网页版改动带进已弃用的工程，否决；运行时用 `<script src>` 外链——srcdoc 与 `document.write` 的相对路径基准不同，易出错，否决。

### D3：预览 = iframe srcdoc 注入 + 同源直调渲染函数
- 切换模板时：获取模板 HTML，在 `</head>` 前注入 `<script>window.__SHOWME_DATA__ = JSON.parse(<双重 stringify 且 `</` 转义为 `<\/`>)</script>`，赋给 iframe `srcdoc`。
- 数据变化时（模板未变）：iframe 已加载则直接调用 `iframe.contentWindow.__showme_render(data)`（srcdoc 与父页面同源），无闪烁；未加载完则等待 `load` 事件后渲染最新数据。数据变化做约 120ms 防抖。
- 预览组件按容器宽度把 A4 页面（794px）等比缩放，使手机上也能看到整页版式；多页时各页纵向排列，并显示总页数。

### D4：存储层接口化 + 单点数据校验
- `ResumeStore` 接口：`load(): Resume`、`save(resume)`；第一版实现 `LocalResumeStore`（localStorage，键 `showme.resume.v1`），模板选择存 `showme.template`。后续云同步只需新增实现，编辑器与预览不改。
- 自动保存：状态变化后 300ms 防抖写入。
- `normalizeResume(unknown): Resume` 是唯一的数据入口校验：缺失字段补默认值、未知字段忽略、类型不符（如字符串字段为数字、数组项为 null）判为非法并抛错——语义与 Android 版 kotlinx（ignoreUnknownKeys、字段有默认值、非 lenient）一致。本地加载、JSON 导入、链接接收三处都只走这一个函数。
- 本地数据损坏：原始文本另存到 `showme.resume.corrupt` 以免丢失，界面使用示例简历并提示。

### D5：离线长链接 = URL hash 携带压缩数据（备用通道）
- 编码：`#r=1.` + `LZString.compressToEncodedURIComponent(JSON.stringify(resume))`，前缀 `1.` 为编码版本号。序列化时省略空字符串 / 空数组字段（解码后由 `normalizeResume` 补回默认值）。
- 实测：示例简历约 1500 字符。第一版曾把它做成二维码，结果约 149×149 模块，在手机屏幕上每模块不足 2px，实际扫不出。因此**长链接不再生成二维码**，只作为无服务 / 未部署中转时的复制发送通道；二维码一律走 D12 短码。
- 放在 hash 中的原因：hash 不会随请求发送给托管服务器，静态托管方看不到简历内容。
- 接收：应用启动时检测 `#r=`（或 D12 的 `#s=`），解码并经 `normalizeResume` 校验后进入"收到的简历"视图（只读预览 + 「导入为我的简历」/「仅查看」）。导入前若本地已有不同内容，需二次确认覆盖。处理完用 `history.replaceState` 清除 hash，防止刷新后重复导入。解码失败则提示"链接已损坏"，本地数据不变。
- 当前地址为 `localhost` / `127.0.0.1` 时，提示该链接只能在本机打开。

### D6：响应式外壳
- 断点 900px。窄屏：顶部大标题 + 内容区 + 底部标签栏（编辑 / 预览 / 分享），适配 `env(safe-area-inset-*)`。宽屏：顶部栏（模板选择、导入导出、分享、打印）+ 左侧编辑器（约 460px，可滚动）+ 右侧实时预览（随页面滚动固定在可视区）。
- 视觉沿用 Android 版设计约定：系统字体栈、`#F2F2F7` 底色、白色卡片 16px 圆角、`#0A84FF` 强调色、毛玻璃顶栏。

### D7：PDF 导出 = 独立打印页
- 点击「打印 / 导出 PDF」时，将 `{ resume, templateId }` 写入 localStorage 键 `showme.print.payload`，然后用 `window.open` 打开 `print.html`（Vite 多页入口）。该页读取载荷和模板，渲染为**顶层文档**后调用 `window.print()`。
- 理由：在手机浏览器里，iframe 内调用 `print()` 往往打印的是整个外层页面，而顶层文档打印在各平台都可靠；分页由模板运行时完成（D11），打印时每个 `.sheet` 即一张 A4。"收到的简历"（尚未导入）也能通过同一载荷打印。
- 打印页在窄屏的屏幕显示中用 `zoom` 把纸张整体缩小（仅 `@media screen`，顶栏保持正常大小），不出现横向滚动；`beforeprint` 时恢复原大小并重新分页，保证打印分页与纸张一致。分页测量只用 `getBoundingClientRect`，不受缩放影响。
- 备选：`iframe.contentWindow.print()`——桌面 Chrome 可用，但移动端不可靠，否决；Blob URL 新开标签——iOS 对 Blob 弹窗限制多，否决。

### D8：PWA
- 使用 `vite-plugin-pwa`（generateSW）：预缓存应用外壳、`print.html` 和三套模板；manifest 设置 `display: standalone`、主题色 `#0A84FF`。
- 图标：由仓库内的 Node 脚本生成 192/512 PNG（纯色圆角方块 + 几何标识，不依赖图像工具），另附一个 SVG。
- Service Worker 只在 HTTPS 或 localhost 下生效；用局域网 IP 调试时不可安装，属预期。

### D9：验证策略
- 单元测试（Vitest）：`normalizeResume` 的合法/非法/补默认值场景，链接编解码往返，超长链接阈值判定。
- 端到端：本机 `vite preview`，用 Chrome 分别在桌面视口和手机视口（390×844）下走查编辑、预览、模板切换、导入导出、链接接力、打印页。
- 分页实测：用 Chrome 无头模式 `--print-to-pdf` 把多页简历实际打成 PDF，核对页数与预览一致、无多余空白页。
- 二维码：核对短码链接长度与二维码版本（模块数），并在本地模拟中转上走通"生成 → 另一上下文打开 → 导入"。

### D10：多行文本的统一显示规则
- 自我评价、项目描述、工作描述、教育补充说明统一由运行时 `SM.rich(text)` 渲染：单个回车 = 换行；空行 = 分段（段间距）；以 `-`、`*`、`•`、`·` 开头的行 = 圆点列表项。每一行是一个独立的分页单元，长文本可以在行与行之间跨页。
- 工作经历新增 `description: string`（工作描述，显示在亮点列表之前）；`highlights` 仍为每行一条圆点。旧数据（含 Android 版导出）缺少该字段时补空字符串，`version` 仍为 1。
- 备选：只给段落加 `white-space: pre-line`——能显示换行，但整段变成一个不可拆分的块，分页时只能整段挪页，否决。

### D11：模板运行时分页（预览与打印共用）
- 版面模型：每页是固定尺寸的 `.sheet`（210mm × 297mm），页边距由模板在 `.sheet` 内边距中定义，`@page { size: A4; margin: 0 }`。模板声明一个或多个内容流（单栏模板只有 `main`；双栏模板有 `side` 与 `main`），每页的每个流对应一个固定高度的槽位 `[data-flow]`。
- 算法：先把整段流内容放进第 1 页的槽位，按文档顺序找到第一个底边超出槽位的分页单元 `[data-u]`，在其前断开：克隆其祖先链（不含子节点）到下一页槽位，把断点及其后的内容逐层移过去，再对新页重复。分页结果是真实的多页 DOM，预览显示的就是打印出来的。
- 断点规则：
  - `data-keep`（分节标题、条目抬头）与下一单元同页，不独自留在页底；
  - `data-avoid`（单条经历）高度不超过版心 40% 时整体移到下一页（避免长条目整体下移留下大片空白），更长时在其内部的行 / 圆点之间拆开；
  - 每页至少保留一个单元，保证终止。
- 双栏模板每页都绘制侧栏底色，并保留上下边距；侧栏内容过多时同样续排到下一页。
- iframe 不可见（如手机端预览标签未打开）时无法测量：运行时记下未完成状态，窗口尺寸变化时重新分页；字体加载完成后也重排一次。
- 备选：只靠浏览器打印分页 + CSS `break-*`——预览无法显示分页位置，双栏侧栏与续页边距无法控制，第一版已证明效果差，否决；Paged.js——体积大、会接管整个文档，与同源直调重绘的预览方式冲突，否决。

### D12：加密短码中转（二维码主路径）
- 部署形态：站点部署到 Cloudflare Pages；`web/functions/api/relay/` 下的 Pages Functions 提供接口，数据存 Workers KV（绑定名 `RELAY`）。业务逻辑在 `web/server/relay.ts`，由 Pages Functions 与 vite 开发/预览服务器共用（本地用内存模拟 KV）。
- 接口：
  - `POST api/relay`：请求体为 base64url 密文（上限 64KB）；生成 10 位随机短码写入 KV，`expirationTtl` 7 天；返回 `{ id, expiresAt }`。
  - `GET api/relay/<id>`：返回密文；不存在或已过期返回 404。
- 加密：浏览器用 WebCrypto 生成随机 128 位 AES-GCM 密钥，明文为 lz-string 压缩后的简历 JSON，上传 `IV(12B) || 密文`。分享链接 `<站点>#s=1.<短码>.<密钥>`（约 70 字符），密钥只在 hash 中、不发给服务器，服务端只保存无法解读的密文。
- 二维码：只编码短码链接，纠错等级 M，约 QR 版本 5（37×37 模块），与简历长度无关。
- 交互：短码由用户点「生成二维码」时创建（不随输入自动上传），内容为当时的快照；之后简历有改动时提示「简历已修改，重新生成」。生成失败（未部署接口、离线、非安全上下文无 WebCrypto）时提示原因，并引导使用离线长链接。
- 接收：`#s=` → 先清除 hash → 拉取密文 → 解密 → 解压 → `normalizeResume`；404 提示"分享已过期或不存在"，解密/校验失败提示"链接已损坏"，网络错误提示检查网络。
- Service Worker 的导航回退排除 `api/` 路径。
- 备选：多帧轮播二维码——接收端需自带扫码，电脑摄像头识别不可靠，否决；WebRTC 直连——同样需要信令服务，且要求两端同时在线，否决；第三方公共剪贴板服务——不可控、可能随时停服，否决。

## Risks / Trade-offs

- [数据只存在浏览器里，清除浏览器数据或换浏览器就会丢失] → 首次使用及「分享」页显著提示"建议定期导出备份"；提供一键导出 JSON。
- [二维码依赖短码中转，未部署到 Cloudflare 时不可用] → 分享页保留离线长链接；生成失败时明确提示原因。
- [中转接口公开可写，可能被滥用占用 KV 免费额度（每日约 1000 次写入）] → 限制请求体 64KB、数据 7 天自动过期；个人使用规模下可接受，若出现滥用再加 Cloudflare 限流规则。
- [短码链接被他人拿到即可查看简历] → 链接即凭证，7 天后失效；分享页提示只发给自己或信任的人。
- [分页在屏幕上测量，打印时若字体渲染略有差异，内容可能贴近页底] → 槽位高度固定、`.sheet` 内容裁剪在纸张内，打印样式不改变任何尺寸；用无头 Chrome 实打 PDF 验证。
- [链接接力不是实时同步，两端可能各自修改后互相覆盖] → 导入前二次确认，并在确认框中展示对方简历的姓名。
- [`window.open` 可能被拦截] → 只在用户点击时同步调用；被拦截时提示"请允许弹出窗口"，并提供在当前页跳转打印页的备选入口。
- [iOS Safari 打印到 PDF 需用户在分享菜单选择"打印"再双指放大存为 PDF] → 打印页给出平台对应的操作提示。
- [模板已与 Android 版分离] → Android 工程不再维护（用户确认），其旧模板不支持分页与工作描述字段。

## Migration Plan

- 本地运行：`cd web; npm install; npm run dev`（含模拟中转接口）。手机同 Wi-Fi 试用：`npm run dev -- --host`，用电脑的局域网 IP 访问（非 https 下无 WebCrypto，只能用长链接）。
- 上线：创建 KV 命名空间并填入 `web/wrangler.toml`，执行 `npm run deploy`（构建后 `wrangler pages deploy`）。回滚即在 Cloudflare 控制台把生产环境指回上一次部署。

## Open Questions

- 站点域名：先用 Cloudflare Pages 分配的 `*.pages.dev`，是否绑定自有域名由用户决定。
