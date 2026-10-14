## 1. 工程脚手架

- [x] 1.1 创建 Gradle 工程：`settings.gradle.kts`、根 `build.gradle.kts`、`gradle.properties`、`app/build.gradle.kts`（Compose + kotlinx-serialization + NanoHTTPD + ZXing 依赖）
- [x] 1.2 创建 `app/src/main/AndroidManifest.xml`（应用名 ShowMe、`usesCleartextTraffic`、MainActivity 导出配置）与 gradle wrapper 配置
- [x] 1.3 创建应用图标（自适应图标：矢量前景 + 背景色）

## 2. 数据模型与持久化（resume-model）

- [x] 2.1 实现 `Resume.kt`：Resume/Basics/Education/Work/Project/SkillGroup 可序列化模型 + 中文示例简历
- [x] 2.2 实现 `ResumeRepository`：加载（含损坏回退）、500ms 防抖保存、模板选择持久化
- [x] 2.3 实现 `ResumeViewModel`：StateFlow 状态、编辑操作 API（字段更新/条目增删移）、PC 回传后刷新

## 3. 主题与 UI 框架

- [x] 3.1 实现 iOS 风主题（Color/Type/Theme：#F2F2F7 底、白卡片、#0A84FF 点缀）与通用卡片/分组列表组件
- [x] 3.2 实现 MainActivity + 底部导航（编辑/预览/电脑三页骨架）

## 4. 块式编辑器（resume-editor）

- [x] 4.1 实现基本信息节（姓名/头衔/电话/邮箱/城市）与自我评价节表单
- [x] 4.2 实现可重复条目节（教育/工作/项目/技能）：卡片内字段编辑 + 新增/删除/上移/下移

## 5. 模板与预览、PDF（resume-templates / pdf-export）

- [x] 5.1 编写共享渲染契约说明与 `classic`（简雅）模板（HTML+CSS+render JS+@media print）
- [x] 5.2 编写 `air`（清朗）与 `duo`（双栏）模板
- [x] 5.3 实现预览页：模板切换 chips、WebView 注入渲染、空内容省略验证
- [x] 5.4 实现 PDF 导出：PrintManager + WebView PrintDocumentAdapter，打印时隐藏操作元素

## 6. 局域网电脑接力（lan-relay）

- [x] 6.1 实现 `ResumeServer`（NanoHTTPD）：GET /（H5）、GET /api/resume、POST /api/resume?token=（令牌校验 + 结构校验 + 落盘 + 回调刷新）、随机端口重试
- [x] 6.2 实现局域网 IP 枚举与二维码生成（ZXing → Compose Image）
- [x] 6.3 实现「电脑」页：启动/停止开关、地址与二维码展示、备选地址、使用提示（同一 Wi-Fi、保持页面打开）、离开页面停止服务
- [x] 6.4 编写 PC 端 H5 单页 `assets/web/index.html`：加载简历渲染、只读模式（查看+打印）、令牌编辑模式（表单+保存 POST）、保存结果反馈

## 7. 验证与收尾

- [x] 7.1 H5/模板静态验证：本地渲染示例简历、空分节省略、打印样式（浏览器）
- [x] 7.2 Kotlin 编译验证（沙箱无 JDK17/Android SDK，已记录为待真机验证项，见 _local/docs/showme-真机验证清单.md）
- [x] 7.3 真机验证清单输出：安装、编辑保存、预览三模板、PDF 导出、PC 扫码查看/编辑/打印
- [x] 7.4 `openspec validate` 通过并向用户交付说明
