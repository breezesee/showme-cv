## 1. 工程搭建

- [x] 1.1 在 `web/` 创建 Vite + Vue 3 + TypeScript 工程（package.json、tsconfig、vite.config.ts、index.html、print.html 多页入口），安装依赖：vue、lz-string、qrcode、vite-plugin-pwa、vitest
- [x] 1.2 在 vite.config.ts 中实现模板插件：开发时把 `/templates/<id>.html` 映射到 `app/src/main/assets/templates/`，构建时输出到 `dist/templates/`；`.gitignore` 增加 `web/node_modules/`、`web/dist/`
- [x] 1.3 全局样式：iOS 风设计变量（底色、卡片、强调色、圆角、字体栈、安全区），900px 断点

## 2. 数据层

- [x] 2.1 `src/model/resume.ts`：Resume 类型定义（与 Android 版 JSON 结构一致）、空条目工厂、中文示例简历
- [x] 2.2 `normalizeResume`：补默认值、忽略未知字段、类型不符时抛错；附单元测试
- [x] 2.3 `ResumeStore` 接口与 `LocalResumeStore` 实现（损坏时备份原文并回退示例）；`useResume` 组合函数（全局响应式状态、300ms 防抖自动保存、模板选择记忆）
- [x] 2.4 JSON 导出（下载文件）与导入（读取文件 → 校验 → 二次确认覆盖 → 失败提示）

## 3. 编辑器

- [x] 3.1 通用组件：分节卡片（可折叠）、表单字段（单行/多行）、条目操作栏（上移/下移/删除，44px 触控区）
- [x] 3.2 六个分节的编辑表单（基本信息、教育、工作、项目、技能、自我评价），条目增删移动，删除二次确认
- [x] 3.3 多行列表输入（工作亮点、技能条目）：输入时保留原始文本，不吞回车

## 4. 预览与打印

- [x] 4.1 `TemplatePreview` 组件：拉取模板、srcdoc 注入数据、同源直调 `__showme_render`、120ms 防抖、按容器宽度缩放 A4 页
- [x] 4.2 模板切换器（简雅/清朗/双栏）
- [x] 4.3 打印页 `print.html`：读取打印载荷，以顶层文档渲染模板后调用 `window.print()`，显示平台操作提示；主界面打印按钮（弹窗被拦截时提示并提供备选跳转）

## 5. 链接接力

- [x] 5.1 `src/relay/link.ts`：`#r=1.` 编解码（lz-string）、长度阈值判定；附往返、损坏数据单元测试
- [x] 5.2 分享面板：接力链接、复制、系统分享（如支持）、二维码、过长提示、localhost 提示、使用方向说明、备份提示
- [x] 5.3 接收流程：启动时解析 hash → 「收到的简历」只读视图（导入/仅查看/打印）→ 覆盖确认 → 清除 hash；损坏链接提示

## 6. 响应式外壳与 PWA

- [x] 6.1 `App.vue`：宽屏顶部工具栏 + 编辑/预览双栏；窄屏大标题 + 底部标签栏（编辑/预览/分享）；全局提示条（toast）
- [x] 6.2 PWA：manifest、Service Worker 预缓存（含模板与打印页）、图标生成脚本（192/512 PNG + SVG）

## 7. 验证

- [x] 7.1 `vue-tsc` 类型检查、Vitest 单元测试、`npm run build` 全部通过
- [x] 7.2 浏览器端到端走查（桌面 1280 宽、手机 390×844）：编辑预填与实时预览、条目管理、模板切换与记忆、刷新持久化、导入导出、链接生成→新上下文打开→导入往返、损坏链接、打印页、XSS 转义、无横向滚动、离线加载
- [x] 7.3 编写使用说明与验证清单（放在 `_local/docs/`，不入库），并通过 `openspec validate`

## 8. 第二轮：换行、分页、短码二维码

- [x] 8.1 模板迁入 `web/templates/`；共享运行时 `runtime.js/runtime.css`（转义、多行文本 `SM.rich`、分页 `SM.paginate`、`SM.mount`），由 vite 插件替换 `<!--showme:runtime-->` 内联（开发与构建一致）
- [x] 8.2 重写三套模板为 A4 分页版式（`.sheet` + `data-flow` 槽位、`data-u/keep/avoid` 标记；duo 每页画侧栏）
- [x] 8.3 数据模型新增 `work.description`（normalize 兼容旧数据、示例补充）；编辑器新增工作描述、教育说明改多行、字段下方说明格式规则
- [x] 8.4 预览逐页显示与「共 N 页」；打印页屏幕上按屏宽缩放纸张、打印前恢复原大小并重新分页
- [x] 8.5 短码中转：`server/relay.ts` 处理逻辑、Pages Functions、`wrangler.toml`、vite dev/preview 内存 KV 模拟、SW 排除 `/api/`
- [x] 8.6 前端加密短码：`relay/cloud.ts`（AES-GCM + lz）、`#s=1.` 解析、接收端异步取回与三种失败提示、分享面板重构（短码二维码 / 离线长链接 / 备份）
- [x] 8.7 单元测试（rich、加解密往返、中转处理、hash 解析）、类型检查、构建；浏览器验证换行/分页/短码往返；无头 Chrome 打印 PDF 核对页数；二维码版本核对
- [x] 8.8 更新 `_local/docs/` 使用说明（Cloudflare 部署步骤）并通过 `openspec validate`
