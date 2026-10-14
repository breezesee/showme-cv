## ADDED Requirements

### Requirement: 一键导出 PDF
预览页 SHALL 提供「导出 PDF」入口，调用系统打印框架打印当前预览 WebView，用户可在系统面板中将输出目标选择为「另存为 PDF」。

#### Scenario: 导出 PDF
- **WHEN** 用户在预览页点击「导出 PDF」并在系统面板选择"另存为 PDF"
- **THEN** 系统生成与当前预览一致的 PDF 文件

### Requirement: 打印样式
模板 SHALL 内置 `@media print` 样式：A4 纸型、隐藏非内容元素、条目卡片 `break-inside: avoid` 防止跨页截断。

#### Scenario: 多页打印不截断
- **WHEN** 简历内容超过一页并以 PDF 导出
- **THEN** 单个条目卡片不被从中间截断

### Requirement: 导出与预览一致
导出的 PDF 内容 SHALL 与导出时刻的预览渲染（模板、数据）一致。

#### Scenario: 模板一致性
- **WHEN** 用户当前使用「清朗」模板导出 PDF
- **THEN** PDF 版式与「清朗」模板预览一致
