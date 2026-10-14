<div align="center">

<img src="docs/images/cover.png" alt="ShowMe 简历" width="100%" />

# ShowMe · 简历网页版

**打开即用的在线简历工具 —— 手机、平板、电脑都能编辑，数据只存在你自己的设备上。**

[![▶ 在线演示](https://img.shields.io/badge/%E2%96%B6_%E5%9C%A8%E7%BA%BF%E6%BC%94%E7%A4%BA-showme--cv.netlify.app-0071e3?style=for-the-badge&logo=googlechrome&logoColor=white)](https://showme-cv.netlify.app)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![PWA](https://img.shields.io/badge/PWA-离线可用-brightgreen?style=flat-square)](#-亮点特性)
[![Netlify](https://img.shields.io/badge/Deploy-Netlify-00c7b7?style=flat-square&logo=netlify&logoColor=white)](https://www.netlify.com)

</div>

---

ShowMe 是一款**零后端、零账号**的响应式简历工具。无需注册、无需下载 App，浏览器打开就能写；写完自动存在本地，可一键导出 A4 PDF，还能通过加密短链接 / 二维码在手机与电脑之间接力传简历。

## ✨ 亮点特性

| | 特性 | 说明 |
| :---: | :--- | :--- |
| 🎨 | **3 套排版 × 8 种配色** | 简雅 / 清朗 / 双栏，搭配清爽、石墨、暖阳、薄荷、暮蓝、紫雾、蔷薇、森语，自由组合一键切换 |
| 📱 | **全端自适应** | 手机单栏 + 底部导航，电脑左右双栏实时预览，平板自动限宽居中 |
| 🔒 | **数据只在你手里** | 简历保存在浏览器本地，无服务器、无账号；分享走端到端加密，密钥只在链接 `#` 之后，服务器只见密文 |
| 🔗 | **跨设备接力** | 生成短码 / 二维码，手机 ↔ 电脑互传简历，7 天自动过期，也可用纯离线长链接 |
| 🖨️ | **一键导出 PDF** | 浏览器打印即得标准 A4，智能分页：标题不落页底、短条目整体下移 |
| ⚡ | **离线 PWA** | 「添加到主屏幕」后像原生 App 一样从桌面启动、断网可用 |

## 🖼️ 界面一览

**宽屏双栏** —— 左侧块式编辑，右侧所见即所得预览，顶部八种配色即点即换：

![宽屏编辑与实时预览](docs/images/desktop-editor.png)

**手机窄屏** —— 单栏大标题 + 底部导航，编辑 / 预览 / 分享随手切换，改动自动保存：

![移动端界面](docs/images/mobile.png)

## 🚀 快速开始

> 环境要求：Node.js ≥ 22。所有命令在项目根目录的 `web/` 下执行。

```bash
cd web
npm install        # 安装依赖
npm run dev        # 本地开发，http://localhost:5173
```

| 命令 | 作用 |
| :--- | :--- |
| `npm run dev` | 本地开发服务器（内置内存版短码中转） |
| `npm run build` | 类型检查（`vue-tsc`）+ 构建到 `dist/` |
| `npm test` | 运行单元测试（Vitest） |
| `npm run typecheck` | 仅做类型检查 |
| `npm run preview` | 预览构建产物（含 Service Worker），http://localhost:4173 |
| `npm run deploy` | 构建并发布到 Netlify |

## 🧱 技术栈

- **框架**：[Vue 3](https://vuejs.org) + [TypeScript](https://www.typescriptlang.org) + [Vite 7](https://vitejs.dev)
- **离线 / 安装**：[vite-plugin-pwa](https://vite-pwa-org.netlify.app) + Workbox
- **接力分享**：`lz-string`（离线长链接压缩）+ `qrcode`（二维码）+ 浏览器原生 `Web Crypto`（AES-GCM 端到端加密）
- **短码中转**：Netlify Functions + Netlify Blobs（平台无关业务逻辑在 `web/server/relay.ts`）
- **测试**：[Vitest](https://vitest.dev)
- **模板渲染**：三套自包含 HTML 模板（`window.__showme_render` 契约），预览、打印、分享共用同一份渲染逻辑

## 📁 项目结构

```
jianli/
├── web/                      # 网页版主工程
│   ├── src/
│   │   ├── components/       # 编辑器、预览、主题/模板选择器等
│   │   ├── store/            # 简历数据与设备级偏好（localStorage）
│   │   ├── templates/        # 模板加载、主题目录、渲染数据
│   │   ├── relay/            # 接力：加解密、短链、链接解析
│   │   ├── print/            # 打印导出 PDF
│   │   └── model/            # 简历数据模型与规范化
│   ├── templates/            # air / classic / duo 三套模板 + 共享运行时
│   ├── netlify/functions/    # 短码中转函数（Netlify 适配层）
│   └── server/               # 平台无关的中转业务逻辑
├── openspec/                 # 规格驱动开发文档（proposal / design / specs / tasks）
└── docs/images/              # 本文档配图
```

## 🎨 排版 × 主题是怎么解耦的

排版（模板）与配色（主题）互相独立，可任意组合：

- 主题目录集中在 `web/src/templates/themes.ts`，全部视觉都是 **CSS 变量覆盖**，写死在 `web/templates/runtime.css` 里；
- 渲染数据带一个可选 `showmeTheme` 字段，运行时据此在 `<html>` 上设置 `data-theme`，从而套用对应主题；
- 排版和配色都是**设备级偏好**（存在 `localStorage`），不随简历数据走 —— 对方打开你的分享链接时，用的是他自己设备上的排版与配色。

## 🌐 部署

站点与短码中转一起部署在 **Netlify 免费额度**内：

- 线上地址：<https://showme-cv.netlify.app>
- 一键发布：`cd web && npm run deploy`
- 中转接口：`POST /api/relay`（存密文返回短码）、`GET /api/relay/<短码>`（取密文），密文上限 64KB、7 天自动过期。

> 若只需要纯静态站点、不要扫码接力，把 `web/dist/` 上传到任意静态托管即可，其余功能不受影响。

## 📝 关于数据

- 简历内容**只保存在当前浏览器**的本地存储中；换浏览器、清理网站数据或使用无痕模式都会看不到，请定期用「导出」备份 JSON。
- 分享链接即凭证：拿到短链接的人在有效期内可看到简历内容，请只发给信任的人。

---

<div align="center">

**觉得有用？给个 ⭐ 支持一下！**

[▶ 立即体验](https://showme-cv.netlify.app)

</div>
