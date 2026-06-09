# WorkFlow

WorkFlow 是一个基于 Tauri 2、React 19、Vite 和 React Flow 的节点式 AI 图片工作流桌面应用。它把文本输入、图片输入、文生图、图生图和输出节点放在同一个画布中，通过连线组成可重复运行的图片生成流程。

## 项目定位

本项目面向需要反复调试图片生成链路的设计师、内容创作者和开发者。第一版重点是本地桌面工作流，而不是云端协作或复杂自动化。

当前支持：

- 在无限画布上创建、移动、选择和连接节点。
- 当前已支持基础节点选择和移动；框选、多选批量移动、快捷键、撤销重做、节点复制粘贴、自动布局、节点分组和缩放定位是第一版需要补齐的画布编辑能力。
- 使用文本输入节点为文生图或图生图节点提供 prompt。
- 使用图片输入节点导入本地图片，作为图生图或输出节点输入。
- 配置 OpenAI 兼容的图片模型供应商。
- 单独运行节点或运行整个工作流。
- 在节点中预览运行结果图片。
- 右键图片执行保存、复制到剪切板、在文件夹中显示。
- 右键删除节点和连线。
- 手动保存当前工作流，下次打开应用恢复画布。第一版只维护 1 个工作流，后续再扩展多个工作流项目。

界面说明：

```text
左侧：节点库与运行操作
中间：React Flow 工作流画布
右侧：选中节点属性面板
底部：运行日志
```

功能截图建议放在 `docs/screenshots/` 下，并在后续补充到本节，例如：

```md
![工作流画布](docs/screenshots/workflow-canvas.png)
![AI 供应商设置](docs/screenshots/provider-settings.png)
```

## 技术栈

- 前端：React 19、TypeScript、Vite、`@xyflow/react`
- 桌面壳：Tauri 2
- 后端：Rust 2021
- HTTP 客户端：`reqwest`
- 图片处理：`image`
- 剪切板：`arboard`

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

启动完整 Tauri 桌面应用：

```bash
npm run tauri dev
```

构建前端：

```bash
npm run build
```

检查 Rust 后端：

```bash
cd src-tauri
cargo check
```

构建桌面安装包：

```bash
npm run tauri build
```

## Tauri 开发前置条件

本项目使用 Tauri 2。开发机器需要准备：

- Node.js 与 npm。
- Rust 工具链，推荐通过 `rustup` 安装。
- 平台相关系统依赖：
  - Windows：Microsoft C++ Build Tools / Visual Studio Build Tools。
  - macOS：Xcode Command Line Tools。
  - Linux：WebKitGTK、GTK、AppIndicator 等 Tauri 运行依赖。

具体依赖以 Tauri 2 官方文档为准。首次运行 `npm run tauri dev` 时，如果 Rust 或系统 WebView 依赖缺失，Tauri CLI 会在终端输出对应错误。

## AI 供应商配置

应用内通过“AI 设置”面板维护供应商配置。配置项包括：

- 供应商 ID：节点引用供应商时使用的稳定标识。
- 名称：界面展示名称。
- Base URL：OpenAI 兼容 API 地址，例如 `https://api.openai.com/v1`。
- API Key：请求供应商 API 时使用的 Bearer Token。
- 代理地址：可选，传给 `reqwest::Proxy::all`，用于 HTTP/HTTPS 代理。
- 模型列表：每个模型需要配置模型 ID、展示名称和能力类型。

默认内置两个供应商模板：

- OpenAI：`https://api.openai.com/v1`
- Agnes AI：`https://apihub.agnes-ai.com/v1`

模型能力分为：

- `textToImage`：文生图节点可用。
- `imageToImage`：图生图节点可用。

运行时会校验节点选择的供应商、模型和能力是否匹配。如果模型能力配置错误，会出现“模型预设不存在或能力不匹配”一类错误。

## 环境变量

当前项目不需要 `.env` 才能启动。AI Key 通过应用内“AI 设置”面板填写，不通过 `OPENAI_API_KEY`、`AGNES_API_KEY` 或 `VITE_*` 环境变量读取。

当前代码中使用的环境变量：

- `TAURI_DEV_HOST`：可选，用于配置 Vite/Tauri 开发服务器监听地址，通常本地开发不需要设置。

代理也不通过 `HTTP_PROXY` 或 `HTTPS_PROXY` 读取，而是在 AI 设置里通过“代理地址”配置。

## API Key 存储现状和风险

当前阶段 API Key 由前端配置界面录入并保存在前端状态中，再通过 Tauri command 保存到 Tauri 应用数据目录下的 JSON 文件中：

```text
appData/
  providers/
    config.json
```

这是明文存储。风险包括：

- 本机其他能读取该用户应用数据目录的程序或用户可能读取 API Key。
- 日志、备份、同步盘或排障压缩包可能意外包含该配置文件。
- 如果把应用数据目录内容提交到仓库，会泄露密钥。

当前建议：

- 不要使用高权限或不可撤销的长期 Key。
- 为本应用单独创建 Key，并在供应商后台设置额度和权限限制。
- 不要把 `appData/providers/config.json` 分享给他人。
- 发生泄露时立即在供应商后台吊销并更换 Key。

后续更合理的方案是增加独立 API route 后端。前端工具只调用该后端，由后端统一保存和管理 API Key、转换供应商协议、处理鉴权、审计、限流和错误归一化。

## 本地数据和资源文件

应用通过 Tauri 的 `app_data_dir()` 保存工作流和资源。Windows 上通常位于 `%APPDATA%` 下，实际目录由 Tauri 根据应用标识 `com.qm.workflow-app` 决定。第一版只保存 1 个当前工作流，且由用户手动触发保存。

当前目录结构：

```text
appData/
  workflows/
    current.json
  providers/
    config.json
  assets/
    imported/
    generated/
    thumbnails/
```

说明：

- `workflows/current.json`：当前画布快照，包括节点、连线、位置、参数和结果路径引用。
- `providers/config.json`：AI 供应商、模型和 API Key 配置。
- `assets/imported/`：从本地或剪切板导入的图片。
- `assets/generated/`：AI 生成或编辑后的图片。
- `assets/thumbnails/`：导入图片缩略图。

工作流 JSON 只保存图片路径和元信息，不把图片二进制直接写入 JSON。

后续支持多工作流项目时，建议演进为：

```text
appData/
  workflows/
    {projectId}/
      workflow.json
      assets/
        imported/
        generated/
        thumbnails/
```

项目元信息建议保存在 `appData/workflows/projects.json`：

```json
[
  {
    "id": "project-1781025600000",
    "name": "默认项目",
    "createdAt": "2026-06-09T00:00:00.000Z",
    "updatedAt": "2026-06-09T00:00:00.000Z",
    "lastOpenedAt": "2026-06-09T00:00:00.000Z"
  }
]
```

后续迁移到多项目时，当前 `workflows/current.json` 可以作为默认项目导入到 `workflows/{projectId}/workflow.json`，项目内图片资源放在同级 `assets/` 下，避免不同项目之间的导入图和生成图互相污染。

## 常见错误

### DNS 或网络连接失败

现象：

- 日志出现“图片 API 请求失败”。
- 错误链包含 `Connect`、`tls handshake eof`、`unexpected eof` 等信息。

处理：

- 确认本机能访问供应商 Base URL。
- 检查 DNS 是否能解析供应商域名。
- 如果公司网络或地区网络限制访问，配置可用代理。
- 应用会在部分连接错误时尝试 Cloudflare 公共 DNS 兜底，但这不能替代可用网络。

### 代理配置错误

现象：

- 日志出现“代理地址无效”。
- 请求一直超时或连接失败。

处理：

- 确认代理地址格式正确，例如 `http://127.0.0.1:7890`。
- 确认代理程序正在运行。
- 如果代理要求认证，确认 URL 中包含所需认证信息，或改用系统层代理。

### API Key 缺失或无效

现象：

- 日志出现“供应商缺少 API Key”。
- API 返回 `401`、`403` 或权限相关错误。

处理：

- 在 AI 设置中填写对应供应商的 API Key。
- 确认 Key 没有多余空格。
- 确认 Key 在供应商后台仍有效，并具有图片生成或图片编辑权限。

### 模型能力不匹配

现象：

- 日志出现“模型预设不存在或能力不匹配”。
- 文生图节点或图生图节点无法运行。

处理：

- 文生图节点只能选择 `textToImage` 能力模型。
- 图生图节点只能选择 `imageToImage` 能力模型。
- 检查 AI 设置中的模型 ID 是否与供应商真实模型 ID 一致。

### API 响应格式不兼容

现象：

- 日志出现“图片 API 响应缺少 data[0]”。
- 日志出现“图片 API 响应缺少 data[0].url 或 data[0].b64_json”。

处理：

- 当前后端按 OpenAI 兼容的 `/images/generations` 响应解析。
- 供应商需要返回 `data[0].url` 或 `data[0].b64_json`。
- 如果供应商使用不同字段，需要新增 Provider Adapter 或调整后端解析逻辑。

### 图片输入格式不支持

现象：

- 图生图节点提示输入图片格式不支持。

处理：

- 当前支持 `jpg`、`jpeg`、`png`、`webp`、`gif`。
- 确认导入图片有正确扩展名。

## 代码结构

```text
src/
  App.tsx                     # 主界面、画布状态、Tauri command 调用
  components/                 # 节点卡片、节点库、属性面板、AI 设置面板
  lib/                        # 节点目录、供应商预设、工作流图转换
  types/                      # 前端类型定义
src-tauri/
  src/workflow/commands.rs    # Tauri commands
  src/workflow/executor.rs    # 工作流执行逻辑
  src/workflow/graph.rs       # 连线校验和拓扑排序
  src/workflow/image_provider.rs # OpenAI 兼容图片 API 调用
  src/workflow/providers.rs   # 供应商配置读写和校验
  src/workflow/storage.rs     # 工作流和图片文件存储
```

## 数据契约

前后端共享的工作流快照、节点数据和供应商配置契约见 [docs/workflow-json-schema.md](docs/workflow-json-schema.md)。新增字段或调整字段语义时，应先更新该文档，再同步修改 TypeScript 类型和 Rust serde 类型。

## 提交前检查

提交改动前至少运行：

```bash
npm run build
cd src-tauri
cargo check
```
