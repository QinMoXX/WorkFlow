# WorkFlow 阶段性实施计划

本文基于 `docs/workflow-design.md` 对当前项目实现状态进行对照，并拆分后续阶段。状态标记：

- `[x]` 已实现
- `[~]` 部分实现
- `[ ]` 未实现

## 1. 当前实现对照

### 产品与 MVP

- `[x]` React + Tauri 基础应用结构。
- `[x]` 三栏加底部日志的主界面结构。
- `[x]` React Flow 无限画布、节点渲染、拖拽、缩放、平移、选择。
- `[x]` 节点库：文本输入、图片输入、文生图、图生图、输出节点。
- `[x]` 节点属性面板：可编辑 prompt、供应商、模型、画幅、风格、seed、strength 等字段。
- `[x]` 单节点运行与完整工作流运行入口。
- `[x]` 本地保存与恢复当前工作流 JSON。
- `[x]` 多供应商配置：已有 AI 配置界面、后端持久化和 OpenAI-compatible 图片 Provider Adapter。
- `[x]` 节点运行结果：图片输入、文生图、图生图节点会在自身卡片内展示图片预览，输出节点只记录接收或保存路径。
- `[x]` 图片结果右键菜单：保存、复制、打开位置、重新运行。
- `[x]` 真实外部 AI 图片 API 调用。

### 前端

- `[x]` 使用 `@xyflow/react` 作为画布框架。
- `[x]` 按功能拆分组件：
  - `NodeLibrary`
  - `WorkflowNodeCard`
  - `PropertyPanel`
  - `RunLogPanel`
  - `AiSettingsPanel`
- `[x]` 前端类型拆分：
  - `types/workflow.ts`
  - `types/provider.ts`
- `[x]` 节点目录与图转换逻辑拆分：
  - `lib/nodeCatalog.ts`
  - `lib/workflowGraph.ts`
  - `lib/providerPresets.ts`
- `[x]` 前端连线基础类型校验。
- `[x]` AI 节点从 AI 配置预设中选择供应商和模型。
- `[x]` 节点运行状态展示：已有状态点、错误文本、路径文本和图片结果预览。
- `[x]` 图片输入的文件选择器、剪切板导入和导入资源管理。
- `[x]` 图片结果右键菜单。
- `[ ]` 通过 Tauri event 接收逐节点运行进度。

### 后端

- `[x]` Rust 模块拆分：
  - `workflow/models.rs`
  - `workflow/graph.rs`
  - `workflow/executor.rs`
  - `workflow/storage.rs`
  - `workflow/providers.rs`
  - `workflow/commands.rs`
- `[x]` Tauri commands：
  - `save_workflow`
  - `load_workflow`
  - `run_node`
  - `run_workflow`
  - `save_provider_configs`
  - `load_provider_configs`
- `[x]` 工作流 JSON 保存到 app data。
- `[x]` 供应商配置保存到 app data。
- `[x]` 强类型连线校验。
- `[x]` 有向图构建、环检测、拓扑排序。
- `[x]` 单节点运行时自动补跑上游依赖。
- `[x]` 节点执行器：已有文本、图片路径、AI 节点真实调用和输出节点处理。
- `[~]` API Key 后端存储：已在后端配置文件保存，但还不是系统安全存储或加密配置。
- `[x]` OpenAI 风格图片 Provider Adapter。
- `[x]` 图片下载、落盘、导入图片缩略图生成。
- `[x]` 保存图片、复制图片、打开文件所在目录 commands。

## 2. 阶段一：MVP 骨架收敛

目标：保证节点画布、配置、保存、执行框架稳定可用。

- `[x]` 建立 React Flow 画布。
- `[x]` 建立节点库、节点卡片、属性面板、日志面板。
- `[x]` 建立工作流快照类型和前后端序列化结构。
- `[x]` 建立 Rust 工作流模块。
- `[x]` 实现工作流保存/加载。
- `[x]` 实现连线类型校验、拓扑排序、单节点依赖补跑。
- `[x]` 实现 AI 配置界面和供应商/模型预设选择。

验收标准：

- 用户可以创建节点、连线、编辑节点参数。
- 关闭应用后可以恢复当前工作流。
- 用户可以配置供应商 URL、API Key、模型列表。
- AI 节点只能选择已配置的供应商和模型。

## 3. 阶段二：真实图片 API 接入

目标：把当前模拟 AI 节点替换为真实 OpenAI 风格图片 API 调用。

- `[x]` 在 Rust 后端新增 Provider Adapter 边界，例如：
  - `ImageProvider`
  - `TextToImageInput`
  - `ImageToImageInput`
  - `ImageResult`
- `[x]` 新增 OpenAI-compatible image adapter。
- `[x]` 使用供应商 `baseUrl` 拼接 `/images/generations`。
- `[x]` 使用 `Authorization: Bearer <apiKey>` 发送请求。
- `[x]` 文生图请求支持：
  - `model`
  - `prompt`
  - `size`
  - `seed`
- `[x]` 图生图请求支持：
  - `model`
  - `prompt`
  - `size`
  - `seed`
  - `tags`
  - `extra_body.image`
- `[x]` 解析响应中的图片 URL。
- `[x]` 下载远程图片到 `appData/assets/generated/`。
- `[x]` 将本地结果路径写回节点 `resultPath`，并记录远程 `resultUrl` 供下游图生图使用。
- `[x]` API 错误、超时、响应格式错误写入运行日志。

兼容说明：

- 图生图优先使用上游 AI 节点产生的 `resultUrl`。
- 如果输入是 `http://` 或 `https://` 图片 URL，会原样写入 `extra_body.image`。
- 如果输入是本地图片路径，会读取文件并转换为 `data:image/...;base64,...` 写入 `extra_body.image`，用于兼容支持 data URL 的 OpenAI-compatible 供应商。
- Agnes 文档描述 `extra_body.image` 为图片 URL；如果 Agnes 侧拒绝 data URL，后续需要在阶段三补充本地图片上传或可访问 URL 托管策略。

验收标准：

- 配置 Agnes/OpenAI-compatible 供应商后，文生图节点可以生成真实图片并保存到本地。
- 图生图节点能处理供应商支持的图片输入格式。
- 节点结果路径可被下游节点使用。

## 4. 阶段三：图片资源与结果体验

目标：让输入图片、生成图片和输出节点形成完整本地资源闭环。

- `[x]` 图片输入节点支持本地图片导入：支持文件选择和剪切板粘贴图片。
- `[x]` 导入图片复制到 `appData/assets/imported/`。
- `[x]` 生成缩略图并写入 `thumbnailPath`。
- `[x]` 节点卡片展示图片预览，而不只是路径文本。
- `[x]` 输出节点按 `saveDirectory` 自动复制上游图片；未设置目录时只记录接收到的图片路径。
- `[x]` 实现图片结果右键菜单：
  - 保存图片
  - 复制图片
  - 在文件夹中显示
  - 重新运行该节点
- `[x]` 新增 Tauri commands：
  - `save_image_as`
  - `show_in_folder`
  - `copy_image_to_clipboard`

实现说明：

- 文件选择和剪切板粘贴都会把图片复制到 `appData/assets/imported/`，并把缩略图写入 `appData/assets/thumbnails/`。
- 图片输入、文生图、图生图节点在自身卡片内展示预览；输出节点仍只负责接收或自动保存上游图片。
- 右键图片结果所在节点可执行保存、复制、打开所在文件夹、重新运行该节点。

验收标准：

- 用户可以从本地选择图片作为输入。
- 每个图片节点能直接看到结果预览。
- 生成结果可以保存、复制、打开位置、重新运行。

## 5. 阶段四：运行状态与稳定性

目标：完善长任务运行反馈、错误处理和状态一致性。

- `[ ]` Rust 后端通过 Tauri event 推送节点状态：
  - `queued`
  - `running`
  - `success`
  - `error`
- `[ ]` 前端订阅运行事件并实时更新节点状态。
- `[ ]` 运行全部时，下游节点在上游失败后明确标记为未执行或阻塞。
- `[ ]` API 调用记录耗时、供应商、模型、结果路径。
- `[ ]` 保存工作流时清理不可序列化 UI 状态。
- `[ ]` 对 provider 配置增加重复 ID、重复模型 ID 校验。
- `[ ]` 对本地路径、远程 URL、文件读写失败增加清晰错误信息。

验收标准：

- 运行长任务时 UI 不需要等待最终响应才能看到进度。
- 任一节点失败后，用户能从日志和节点错误中定位原因。
- 配置错误、网络错误、文件错误都有可读提示。

## 6. 阶段五：安全与配置治理

目标：降低 API Key 泄漏风险，并让配置更接近正式桌面应用要求。

- `[ ]` API Key 不再进入前端长期状态。
- `[ ]` `load_provider_configs` 返回配置时默认隐藏或脱敏 API Key。
- `[ ]` 保存配置时支持保留既有 API Key。
- `[ ]` 优先接入系统安全存储；不可用时使用加密本地配置文件。
- `[ ]` 检查 `src-tauri/capabilities/default.json`，只开放必要权限。
- `[ ]` 在 README 中补充供应商配置和 API Key 管理说明。

验收标准：

- 前端不会长时间持有明文 API Key。
- 配置界面仍可更新 API Key。
- 后端执行 API 调用时可以安全读取密钥。

## 7. 当前优先级建议

下一步优先推进阶段四。原因是真实图片 API、节点内图片预览、本地图片导入和结果右键操作已经形成基本闭环，但长任务实时状态仍缺失。

建议顺序：

1. 后端通过 Tauri event 推送逐节点运行状态。
2. 前端订阅运行事件，运行长任务时实时更新节点状态和日志。
3. 运行全部时明确标记下游阻塞状态。
4. 对供应商配置增加重复 ID 和重复模型 ID 校验。
5. 收紧 asset protocol scope，并进入 API Key 脱敏与安全存储治理。
