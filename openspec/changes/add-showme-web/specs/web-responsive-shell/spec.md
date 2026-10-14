## ADDED Requirements

### Requirement: 响应式布局
界面 SHALL 根据视口宽度自动切换布局：宽度不小于 900px 时为双栏（左侧编辑器、右侧实时预览，顶部工具栏放模板切换、导入导出、分享、打印）；宽度小于 900px 时为单栏，底部标签栏切换「编辑 / 预览 / 分享」三个页面，并适配刘海屏与底部安全区。

#### Scenario: PC 双栏
- **WHEN** 在 1280px 宽的桌面浏览器打开网站
- **THEN** 编辑器与预览左右并排，不显示底部标签栏

#### Scenario: 手机单栏
- **WHEN** 在 390px 宽的手机浏览器打开网站
- **THEN** 一次只显示一个页面，底部标签栏可在编辑、预览、分享之间切换，页面没有横向滚动

#### Scenario: 窗口缩放时切换布局
- **WHEN** 桌面浏览器窗口从 1280px 缩小到 800px
- **THEN** 布局切换为单栏标签页，当前简历内容不丢失

### Requirement: iOS 风视觉
界面 SHALL 采用统一的 iOS 风视觉：系统字体、浅灰底色、白色圆角分组卡片、蓝色强调色、毛玻璃顶栏；可点击元素在手机上的触控区域 SHALL 不小于 44×44px。

#### Scenario: 手机触控区域
- **WHEN** 在手机视口检查底部标签栏与条目操作按钮
- **THEN** 每个按钮的可点击区域不小于 44×44px

### Requirement: PWA 安装与离线
网站 SHALL 提供 Web App Manifest 与 Service Worker：在 HTTPS 访问时可添加到手机主屏幕并以独立窗口打开；首次加载后断网再打开，编辑、预览、模板切换 SHALL 仍可使用。

#### Scenario: 离线打开
- **WHEN** 用户访问过网站后断开网络并重新打开
- **THEN** 应用正常加载，显示本地保存的简历，三套模板均可预览

#### Scenario: 可安装
- **WHEN** 检查构建产物
- **THEN** 包含 manifest（名称 ShowMe、standalone 显示模式、192 与 512 尺寸图标）和 Service Worker
