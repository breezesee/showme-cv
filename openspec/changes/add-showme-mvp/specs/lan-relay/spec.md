## ADDED Requirements

### Requirement: 局域网服务开关
「电脑」页 SHALL 提供「启动电脑接力」开关：启动后在手机上监听随机端口提供 HTTP 服务，并展示本机局域网地址、二维码与运行状态；关闭开关或离开该页时 SHALL 停止服务。

#### Scenario: 启动接力
- **WHEN** 用户打开「电脑」页并启动接力开关
- **THEN** 界面显示可访问的地址与二维码，并提示与电脑保持同一 Wi-Fi

#### Scenario: 停止接力
- **WHEN** 用户关闭开关或离开「电脑」页
- **THEN** HTTP 服务停止，PC 端后续请求无法连接

### Requirement: 扫码即达
启动接力后系统 SHALL 生成内容为 `http://<局域网IP>:<端口>/?t=<编辑令牌>` 的二维码；同时 SHALL 在界面以文本展示完整地址供手动输入，并列出备选局域网地址（如存在多网卡）。

#### Scenario: PC 扫码打开
- **WHEN** PC 浏览器扫描该二维码或输入显示的地址
- **THEN** 浏览器打开 H5 页面并渲染出当前简历

### Requirement: 只读与编辑令牌
无令牌访问 SHALL 为只读模式（查看简历 + 浏览器打印）；仅当请求携带正确令牌时 H5 才呈现编辑表单，且服务端 SHALL 对写入请求校验令牌。

#### Scenario: 只读访问
- **WHEN** PC 打开不带 `t` 参数的地址
- **THEN** 页面仅展示简历与打印入口，不提供保存能力

#### Scenario: 令牌错误拒绝写入
- **WHEN** 客户端以错误令牌调用 `POST /api/resume`
- **THEN** 服务返回 403，手机本地数据不变

### Requirement: PC 编辑保存回传
编辑模式下 PC 端 SHALL 提供与简历结构对应的表单，保存时以编辑令牌调用 `POST /api/resume` 提交完整简历 JSON；服务端校验通过后 SHALL 覆盖本地 `resume.json` 并刷新手机端界面数据。

#### Scenario: PC 修改并保存
- **WHEN** PC 在编辑表单中修改姓名并点击保存
- **THEN** 服务端以提交数据覆盖 `resume.json`，返回成功，手机端预览与编辑器随后展示新姓名

#### Scenario: 提交非法数据
- **WHEN** 客户端提交无法解析为合法简历结构的 JSON
- **THEN** 服务返回 400，本地数据不变

### Requirement: HTTP 接口契约
服务 SHALL 暴露：`GET /` 返回 H5 页面；`GET /api/resume` 返回简历 JSON；`POST /api/resume?token=` 接收简历 JSON 并按上述令牌与校验规则处理。H5 页面 SHALL 仅通过这些接口与服务交互（不依赖任何 JS Bridge）。

#### Scenario: 接口可用性
- **WHEN** PC 依次请求 `GET /` 与 `GET /api/resume`
- **THEN** 分别得到 H5 页面（HTML）与当前简历 JSON（application/json）
