# WorkFlow

WorkFlow 是一个基于 Tauri 2、React 19、Vite、TypeScript 和 React Flow 的节点式 AI 图片工作流桌面应用。当前版本面向本地桌面创作工作流：用户在画布中组合文本、图片、图片生成和输出节点，反复运行和调整图片生成链路。

## 当前架构

- 前端：React 19、TypeScript、Vite、Tailwind、`@xyflow/react`。
- 桌面壳：Tauri 2。
- 后端：Rust 2021，负责项目存储、资产管理、运行调度和 New API 图片接口调用。
- AI 接入：不再支持多供应商配置，统一使用固定 New API Base URL：`https://new-api-production-c695.up.railway.app/v1`。供应商平台作为统一分发 API 平台，应用内只保存本地 API Key。

## 主要功能

- 项目管理：左上角项目下拉可切换项目，也可新建项目。
- 多画布：一个项目内可包含多个画布。
- 项目级资产：每个项目是独立文件夹，项目内所有画布共享 `assets/imported`、`assets/generated`、`assets/output` 和 `assets/thumbnails`。
- 资产库：支持搜索、按类型筛选、打开、删除，并可拖拽资产到画布创建图片输入节点。
- 节点画布：支持节点创建、连线、移动、框选、多选、复制粘贴、撤销重做、分组、自动布局和视图定位。
- 统一图片生成节点：只有一个图片生成产品节点。无图片输入时调用图片生成接口；有图片输入时调用图片编辑接口。
- 运行反馈：后端通过 Tauri event 推送运行开始、节点状态、日志和结束事件。
- 运行前检查：前端会提前拦截缺 API Key、缺 prompt、图片输入缺失和模型不可用等确定错误。

## 本地数据结构

应用数据目录由 Tauri `app_data_dir()` 决定。当前主要结构：

```text
appData/
  ai/
    config.json
  workflows/
    projects.json
    projects/
      {projectAssetDir}/
        project.json
        assets/
          imported/
          generated/
          output/
          thumbnails/
```

说明：

- `ai/config.json`：本地明文保存 New API Key。
- `workflows/projects.json`：项目索引，包含当前项目和项目列表。
- `project.json`：项目文件，包含项目元信息、画布列表和每个画布的节点快照。
- `assets/`：项目级共享资产目录。

## AI 接口规则

应用只保存 New API Key，不维护多供应商列表、Base URL、代理和供应商模型配置。

图片生成节点运行时：

- 没有连接图片输入：调用 `{NEW_API_BASE_URL}/images/generations`。
- 连接了图片输入：调用 `{NEW_API_BASE_URL}/images/edits`，以 multipart 方式提交文本和图片。

当前模型列表由代码内置白名单控制。文生图可选：

- `agnes-image-2.0-flash`
- `gpt-image-1`
- `qwen-image-2.0-pro`
- `qwen-image-2.0`
- `qwen-image-max`

图文生图/图片编辑可选：

- `qwen-image-2.0-pro`
- `qwen-image-2.0`

## 开发命令

```bash
npm install
npm run dev
npm run build
cd src-tauri
cargo check
```

启动完整 Tauri 应用：

```bash
npm run tauri dev
```

## 提交前检查

至少运行：

```bash
npm run build
cd src-tauri
cargo check
```

## 安全说明

当前 API Key 保存在本机应用数据目录的 `ai/config.json` 中，属于本地明文持久化。当前架构不调整密钥保存方式。请为本应用使用独立 Key，并在供应商平台限制额度和权限。
