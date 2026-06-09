# WorkFlow 节点式 AI 图片工作流设计方案

## 1. 产品定位

WorkFlow 是一个面向设计师和内容创作者的节点式 AI 图片工作流工具。产品主体验是可视化创作画布，用户可以把文本、图片、AI 处理节点和输出节点通过连线组合起来，形成可重复运行的图片生成与编辑流程。

第一版重点不是复杂自动化，而是让用户能够直观完成：

- 输入文本生成图片。
- 输入图片与文本修改图片风格。
- 查看每个节点的运行结果。
- 单独运行某个节点，或一键运行整个工作流。
- 通过多供应商 API 接入不同图片模型。
- 对节点结果图片执行保存、复制、打开位置、重新运行等操作。
- 使用框选、多选批量移动、快捷键、撤销重做、节点复制粘贴、画布自动布局、节点分组和缩放定位提升画布编辑效率。

## 2. MVP 范围

### 包含功能

- 无限画布上的节点拖拽、移动、选择和连线。
- 画布编辑能力：框选、多选批量移动、快捷键、撤销重做、节点复制粘贴、画布自动布局、节点分组、缩放定位。
- 节点库：文本输入、图片输入、文生图、图生图、输出节点。
- 节点属性面板，用于编辑 prompt、模型、尺寸、风格、seed 等参数。
- 节点运行结果预览。
- 单节点运行与完整工作流运行。
- 多供应商配置，接口风格参考 OpenAI 文本与图片 API。
- 图片结果右键菜单：保存图片、复制图片、在文件夹中显示、重新运行该节点。
- 本地手动保存当前工作流状态。第一版只支持 1 个工作流，后续扩展为多个工作流项目。

### 第一版暂不包含

- 逻辑节点、条件判断、循环与批处理。
- 多图片输入或多图片输出。
- 多工作流项目、工作流文件导入与导出。
- 任意 HTTP 请求节点。
- 复杂模型参数，如 LoRA、ControlNet、采样器、调度器等。

## 3. 主界面布局

采用三栏加底部日志的布局：

```text
左侧：节点库
中间：无限画布
右侧：属性面板
底部：运行日志 / 任务状态，可折叠
```

左侧放置可拖拽节点，保持“少而清晰”。中间画布展示节点、连线、运行状态和结果缩略图。右侧面板展示当前选中节点的参数。底部日志展示 API 调用状态、耗时、错误信息和生成结果路径。

前端画布框架确定采用 React Flow（`@xyflow/react`），用于实现节点拖拽、连线、缩放、平移、多选、自定义节点和父子节点分组等能力。React Flow 只负责画布交互与状态表达，不负责实际节点运行。

### 画布交互要求

第一版画布需要覆盖工作流产品的基础编辑效率：

- 框选节点、多选节点和批量移动。
- 常用快捷键：删除、复制、粘贴、撤销、重做、保存、运行、适配视图。
- 节点复制粘贴时生成新的节点 ID，并保留节点参数、相对位置和可复制的连线。
- 画布自动布局用于整理当前节点图，不改变节点参数。
- 节点分组用于视觉组织和批量移动，暂不改变执行语义。
- 缩放定位包括适配全部节点、定位选中节点、回到默认视图。
- 未来支持多工作流项目后，再补充项目列表、项目切换、导入导出和资源迁移。

## 4. 节点设计

### 数据类型

第一版只支持两类核心数据：

```ts
type WorkflowDataType = "text" | "image";
```

节点端口声明输入输出类型，只有类型匹配时才允许连线。

### 文本输入节点

用途：提供 prompt 或其他文本内容。

- 输入：无
- 输出：`text`
- 字段：`content: string`

### 图片输入节点

用途：从本地选择一张图片，作为图生图或输出节点输入。

- 输入：无
- 输出：`image`
- 字段：`imagePath: string`、`thumbnailPath?: string`

### 文生图节点

用途：调用供应商的图片生成 API，根据文本生成图片。

- 输入：`prompt: text`
- 输出：`image`
- 字段：`providerId`、`model`、`promptOverride?`、`negativePrompt?`、`aspectRatio`、`stylePreset?`、`seed?`

如果已连接文本输入节点，优先使用连接输入作为 prompt；若未连接，则使用节点自身的 prompt。

### 图生图节点

用途：调用供应商的图片编辑或图生图 API，根据输入图片和文本生成新图片。

- 输入：`image: image`、`prompt: text`
- 输出：`image`
- 字段：`providerId`、`model`、`promptOverride?`、`strength`、`aspectRatio`、`stylePreset?`、`seed?`

### 输出节点

用途：作为工作流末端的自动保存节点，把上游图片保存到指定目录。图片预览仍显示在产生该图片的节点内，输出节点只记录接收或保存后的路径。

- 输入：`image`
- 输出：无
- 字段：`saveDirectory?`、`lastOutputPath?`

## 5. 连线规则

第一版采用强类型连线：

- `text -> prompt`
- `image -> image`

允许的连接关系：

- 文本输入 -> 文生图
- 文本输入 -> 图生图
- 图片输入 -> 图生图
- 图片输入 -> 输出
- 文生图 -> 图生图
- 文生图 -> 输出
- 图生图 -> 图生图
- 图生图 -> 输出

当节点连接到后续节点时，连接输出自动作为后续节点输入，不提供“设为后续节点输入”的右键功能。

## 6. API 供应商设计

第一版采用多供应商架构，但接口风格统一参考 OpenAI 的文本与图片 API。应用内部定义统一 Provider Adapter，AI 节点不直接关心具体供应商的请求格式。

```ts
interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  capabilities: {
    textToImage: boolean;
    imageToImage: boolean;
  };
  models: ProviderModel[];
}

interface ProviderModel {
  id: string;
  name: string;
  capability: "textToImage" | "imageToImage";
}

interface ImageProvider {
  textToImage(input: TextToImageInput): Promise<ImageResult>;
  imageToImage(input: ImageToImageInput): Promise<ImageResult>;
}
```

不同供应商通过 Adapter 转换请求与响应。现阶段供应商协议沿用当前 OpenAI-compatible 图片接口实现：使用 `baseUrl` 拼接 `/images/generations`，通过 `Authorization: Bearer <apiKey>` 请求，文生图和图生图都优先解析响应中的 `data[0].url`，兼容 `data[0].b64_json`。图生图当前通过 `extra_body.image` 传入图片来源；如果输入是本地图片，先转成 `data:image/...;base64,...`。后续根据用户反馈再调整供应商协议或增加专用 Adapter。

现阶段为了快速验证产品闭环，API Key 可以由前端配置界面录入并保存在前端状态，再通过 Tauri command 持久化到本地配置文件。后续正式化时，应增加独立 API route 后端，由该后端负责密钥管理、供应商请求、鉴权、审计和限流；前端工具不再直接持有长期明文密钥。

## 7. 工作流执行模型

工作流执行逻辑统一放在 Rust 后端。React 前端只发起“运行单节点”或“运行全部”的命令，并订阅运行状态与结果更新，不在前端实现节点依赖解析、API 请求或文件写入。

### 单节点运行

用户点击某个节点运行时：

1. React 将当前工作流快照、目标节点 ID 发送给 Rust。
2. Rust 检查该节点输入是否完整。
3. 如果依赖的上游节点没有结果，Rust 自动补跑必要上游节点。
4. Rust 调用节点处理逻辑，包括 API 请求、图片读写和结果落盘。
5. Rust 返回节点结果与运行日志。
6. React 更新节点预览、运行状态和日志。

### 运行全部

一键运行完整工作流时：

1. React 将当前工作流快照发送给 Rust。
2. Rust 根据连线构建有向图。
3. Rust 检查是否存在环。
4. Rust 对节点进行拓扑排序。
5. Rust 按顺序执行有输入依赖的节点。
6. 每个节点完成后，Rust 通过 Tauri event 推送状态与结果。
7. 任一节点失败时，Rust 暂停下游执行，并返回错误日志。

节点状态：

```ts
type NodeRunStatus = "idle" | "queued" | "running" | "success" | "error" | "blocked";
```

`blocked` 表示上游节点失败或缺少必要输入，导致该节点没有被执行。它用于区别“尚未运行”的 `idle` 和“自身执行失败”的 `error`。

## 8. 本地数据与文件存储

第一版不提供导入导出，也不提供多工作流项目。当前只维护 1 个工作流，并由用户手动保存当前项目状态。数据分两部分：

- 工作流 JSON：节点、连线、参数、位置、最近结果引用。
- 资源文件：用户导入图片、生成图片、缩略图。

建议目录：

```text
appData/
  workflows/
    current.json
  assets/
    imported/
    generated/
    thumbnails/
```

图片结果不直接写入 JSON，只在 JSON 中记录资源路径和元信息。

后续增加多工作流项目时，建议把目录演进为 `workflows/{projectId}/workflow.json` 和 `workflows/{projectId}/assets/`，避免多个项目共享资源后难以清理或迁移。

## 9. Tauri + React 技术落地

整体采用明确的前后端分离：React 是交互层，Rust 是业务执行层。前端不直接调用 AI 供应商 API，不直接保存生成结果，也不负责工作流执行调度。

### 前端

- React 负责 UI、画布交互和参数编辑。
- React Flow（`@xyflow/react`）作为前端画布框架，负责节点、连线、缩放、平移、多选、自定义节点和父子节点分组。
- Zustand 或 Redux Toolkit 管理前端工作流快照和选中状态。
- 表单组件管理节点属性。
- 右键菜单用于图片操作。
- 通过 Tauri command 请求 Rust 执行节点。
- 通过 Tauri event 接收运行进度、节点结果和错误信息。
- 现阶段前端可以持有供应商 API Key 配置；后续增加独立 API route 后端后，前端只向该后端发起工具调用。

### React Flow 使用边界

React Flow 在项目中承担画布编辑职责：

- 渲染文本、图片、AI 和输出节点。
- 渲染节点输入输出端口和连线。
- 提供拖拽、缩放、平移、框选、多选、复制粘贴、撤销重做、自动布局、分组、选择和删除等基础交互。
- 通过 `parentId` 支持图片集合节点这类父子节点关系。

节点运行、依赖解析、连线类型校验和 API 调用仍由 Rust 后端负责。React Flow 生成的 nodes 和 edges 会被转换为统一的 workflow snapshot，再传递给 Rust 执行。

### Tauri 后端

Rust 后端负责：

- 读取和保存本地工作流 JSON。
- 管理图片文件。
- 校验节点输入和连线类型。
- 构建工作流依赖图。
- 执行拓扑排序和运行调度。
- 执行所有节点运行逻辑。
- 调用外部 AI API。
- 保存图片到用户指定位置。
- 打开文件所在目录。
- 现阶段读取本地保存的供应商 API Key 并执行外部 API 调用；后续由独立 API route 后端接管密钥管理和供应商请求。

建议定义 Tauri commands：

```rust
save_workflow(...)
load_workflow(...)
run_node(workflow_snapshot, node_id)
run_workflow(workflow_snapshot)
save_image_as(...)
show_in_folder(...)
copy_image_to_clipboard(...)
```

Rust 内部再按节点类型分发：

```rust
execute_text_input_node(...)
execute_image_input_node(...)
execute_text_to_image_node(...)
execute_image_to_image_node(...)
execute_output_node(...)
```

## 10. 后续扩展方向

- 工作流导入导出。
- 多工作流项目与项目文件管理。
- 批量图片处理。
- 逻辑节点、条件节点和循环节点。
- 任意 HTTP API 节点。
- 模型高级参数。
- 节点模板和预设工作流。
- 运行历史和版本回滚。
- 云端同步与团队协作。
