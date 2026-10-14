## ADDED Requirements

### Requirement: 三套模板
系统 SHALL 内置三套简历模板（简雅 classic、清朗 air、双栏 duo），均以 HTML+CSS+内联 JS 渲染器实现，从同一份简历 JSON 渲染。

#### Scenario: 模板切换
- **WHEN** 用户在预览页切换模板
- **THEN** 同一份简历数据立即以新模板重新渲染，无需重新输入

### Requirement: 空内容省略
模板渲染 SHALL 跳过为空的字段与分节（如未填项目经历则不渲染该节标题），不渲染占位空白。

#### Scenario: 留空分节
- **WHEN** 简历中项目经历为空
- **THEN** 三套模板的渲染结果中均不出现「项目经历」标题

### Requirement: 实时预览
预览页 SHALL 基于当前简历状态实时渲染：进入预览页或数据变更后，WebView 内容与当前数据一致。

#### Scenario: 编辑后预览一致
- **WHEN** 用户修改任一字段后进入预览页
- **THEN** 预览内容与编辑器中的最新数据一致

### Requirement: 模板选择持久化
用户选择的模板 SHALL 被记住，重启应用后沿用上次选择。

#### Scenario: 重启沿用模板
- **WHEN** 用户选择「双栏」模板后重启应用
- **THEN** 预览与导出默认使用「双栏」模板
