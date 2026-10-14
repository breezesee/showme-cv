## ADDED Requirements

### Requirement: 简历数据模型
系统 SHALL 以 JSON 文档描述单份简历，包含：`basics`（姓名、头衔、电话、邮箱、城市、自我评价）、`education[]`（学校、专业、学历、起止时间、备注）、`work[]`（公司、职位、起止时间、工作亮点列表）、`projects[]`（项目名、角色、起止时间、描述）、`skills[]`（分类、条目列表）与 `version` 字段。

#### Scenario: 完整数据序列化
- **WHEN** 任一能力将简历数据序列化为 JSON
- **THEN** 输出包含上述全部字段结构，未填写的字段以空字符串或空数组表示，不抛异常

### Requirement: 本地自动持久化
系统 SHALL 将简历持久化为应用私有目录下的单一文件 `resume.json`，并在编辑内容变更后 500ms 内（防抖）自动写入，无需用户手动保存。

#### Scenario: 编辑后自动保存
- **WHEN** 用户在编辑器中修改任意字段并停止输入约 500ms
- **THEN** 内存数据被写入 `resume.json`，无任何手动保存动作

#### Scenario: 冷启动恢复
- **WHEN** 应用重新启动
- **THEN** 系统从 `resume.json` 加载上次内容并恢复到编辑器与预览

### Requirement: 首次启动预填示例
系统 SHALL 在首次启动（无 `resume.json`）时提供一份完整的中文示例简历，用户可直接清空改写。

#### Scenario: 首次启动
- **WHEN** 应用首次安装启动且本地无简历文件
- **THEN** 编辑器与预览展示中文示例简历，并可正常编辑与保存

### Requirement: 数据损坏回退
系统 SHALL 在 `resume.json` 无法解析时回退为首次启动的示例内容，且不崩溃。

#### Scenario: 文件损坏
- **WHEN** `resume.json` 内容被破坏（非法 JSON）
- **THEN** 应用以示例简历启动，不崩溃，后续保存覆盖损坏文件
