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
- `[x]` 画布高级编辑：已支持框选、多选批量移动、删除、快捷键、撤销重做、节点复制粘贴、自动布局、节点分组和缩放定位。
- `[x]` 节点库：文本输入、图片输入、文生图、图生图、输出节点。
- `[x]` 节点属性面板：可编辑 prompt、供应商、模型、画幅、风格、seed、strength 等字段。
- `[x]` 单节点运行与完整工作流运行入口。
- `[x]` 本地手动保存与恢复当前工作流 JSON。第一版只维护 1 个工作流，后续再扩展多工作流项目。
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
- `[x]` 框选、多选批量移动、快捷键、撤销重做、节点复制粘贴、画布自动布局、节点分组、缩放定位。
- `[x]` 通过 Tauri event 接收逐节点运行进度。

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
- `[x]` API Key 当前阶段配置方式：前端配置界面持有明文 Key，并通过 Tauri 后端保存到本地配置文件。
- `[x]` OpenAI-compatible 图片 Provider Adapter。现阶段供应商协议沿用当前实现，后续根据用户反馈调整。
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

- `[x]` Rust 后端通过 Tauri event 推送节点状态：
  - `queued`
  - `running`
  - `success`
  - `error`
- `[x]` 前端订阅运行事件并实时更新节点状态。
- `[x]` 运行全部时，下游节点在上游失败后明确标记为未执行或阻塞。
- `[x]` API 调用记录耗时、供应商、模型、结果路径。
- `[x]` 保存工作流时清理不可序列化 UI 状态。
- `[x]` 对 provider 配置增加重复供应商 ID、重复模型 ID 与能力组合校验。
- `[x]` 对本地路径、远程 URL、文件读写失败增加清晰错误信息。

验收标准：

- 运行长任务时 UI 不需要等待最终响应才能看到进度。
- 任一节点失败后，用户能从日志和节点错误中定位原因。
- 配置错误、网络错误、文件错误都有可读提示。

## 6. 阶段五：画布编辑效率

目标：把画布从“能连节点”提升为适合长期使用的工作流编辑器。

- `[x]` 框选节点。
- `[x]` 多选节点后的批量移动、删除和复制。
- `[x]` 快捷键：
  - 删除
  - 复制
  - 粘贴
  - 撤销
  - 重做
  - 保存
  - 运行当前节点或运行全部
  - 适配视图
- `[x]` 撤销重做历史，覆盖节点新增、删除、移动、连线、参数编辑。
- `[x]` 节点复制粘贴，复制节点参数、相对位置和可复制的内部连线，并生成新的节点 ID。
- `[x]` 画布自动布局，优先按依赖方向从左到右排布。
- `[x]` 节点分组，第一版只作为视觉组织和批量移动，不改变执行语义。
- `[x]` 缩放定位：适配全部节点、定位选中节点、回到默认视图。

验收标准：

- 用户能通过鼠标和键盘高效整理中等规模节点图。
- 撤销重做不会破坏节点 ID、连线关系和当前选中状态。
- 自动布局不会修改节点参数或运行结果。

## 7. 阶段六：项目与配置治理

目标：在保持当前单工作流、前端保存 API Key 的前提下，为后续多项目和独立 API route 后端预留迁移路径。

- `[x]` 第一版只支持 1 个工作流。
- `[x]` 第一版使用手动保存，不做自动保存。
- `[x]` 为多工作流项目预留数据目录方案：`workflows/{projectId}/workflow.json` 与项目内 assets。
- `[x]` 增加项目元信息设计：项目 ID、名称、创建时间、更新时间、最近打开时间。
- `[x]` 后续独立 API route 后端设计：
  - 由后端保存和管理 API Key。
  - 前端工具只调用后端 API route。
  - 后端负责供应商协议转换、鉴权、审计、限流和错误归一化。
- `[x]` 当前本地明文 API Key 风险在 README 中明确说明。
- `[x]` 检查 `src-tauri/capabilities/default.json`，只开放必要权限。
- `[x]` 收紧 `src-tauri/tauri.conf.json` 中 asset protocol scope。

验收标准：

- 当前单工作流体验稳定，用户明确知道需要手动保存。
- 当前 API Key 明文保存风险被文档说明。
- 后续多项目和 API route 后端迁移有明确数据结构方向。

## 8. 当前优先级建议

下一步优先补齐多项目元信息。原因是真实图片 API、节点内图片预览、本地图片导入、结果右键操作、长任务实时状态和画布编辑效率已经形成基本闭环。

建议顺序：

1. 后端通过 Tauri event 推送逐节点运行状态。
2. 前端订阅运行事件，运行长任务时实时更新节点状态和日志。
3. 运行全部时明确标记下游 `blocked` 状态。
4. 实现快捷键、撤销重做和节点复制粘贴。
5. 实现框选、多选批量移动、自动布局、分组和缩放定位。
6. 对供应商配置增加重复 ID 和重复模型 ID 校验。
7. 收紧 asset protocol scope，并补充后续 API route 后端设计。
