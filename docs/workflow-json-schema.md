# WorkFlow 数据契约和 JSON Schema

本文档定义前端 TypeScript 与后端 Rust 之间共享的 JSON 契约，覆盖工作流快照、节点数据和 AI 供应商配置。涉及字段变更时，应先更新本文档，再同步修改：

- 前端类型：`src/types/workflow.ts`、`src/types/provider.ts`
- 前端快照转换：`src/lib/workflowGraph.ts`
- 后端类型：`src-tauri/src/workflow/models.rs`、`src-tauri/src/workflow/providers.rs`
- 后端执行和存储逻辑：`src-tauri/src/workflow/`

## 序列化规则

- JSON 字段统一使用 `camelCase`。
- Rust 侧通过 `#[serde(rename_all = "camelCase")]` 与前端字段保持一致。
- 可选字段在 JSON 中允许省略，也允许为 `null`。原因是前端可能省略 `undefined` 字段，而 Rust `Option<T>` 默认序列化为 `null`。
- 枚举值使用小驼峰字符串，例如 `textToImage`、`imageToImage`。
- 路径字段保存本机文件路径字符串，不保存文件二进制。
- 运行结果字段属于派生状态，可以被执行过程覆盖。

## 文件位置

工作流快照：

```text
appData/
  workflows/
    current.json
```

供应商配置：

```text
appData/
  providers/
    config.json
```

资源文件：

```text
appData/
  assets/
    imported/
    generated/
    thumbnails/
```

## WorkflowSnapshot

`WorkflowSnapshot` 是前端传给后端运行、后端返回运行结果、以及本地自动保存的核心数据结构。

```ts
type WorkflowSnapshot = {
  nodes: WorkflowNodeSnapshot[];
  edges: WorkflowEdgeSnapshot[];
};
```

### JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://workflow.local/schema/workflow-snapshot.schema.json",
  "title": "WorkflowSnapshot",
  "type": "object",
  "additionalProperties": false,
  "required": ["nodes", "edges"],
  "properties": {
    "nodes": {
      "type": "array",
      "items": { "$ref": "#/$defs/workflowNode" }
    },
    "edges": {
      "type": "array",
      "items": { "$ref": "#/$defs/workflowEdge" }
    }
  },
  "$defs": {
    "workflowNodeKind": {
      "type": "string",
      "enum": ["textInput", "imageInput", "textToImage", "imageToImage", "output"]
    },
    "workflowDataType": {
      "type": "string",
      "enum": ["text", "image"]
    },
    "nodeRunStatus": {
      "type": "string",
      "enum": ["idle", "queued", "running", "success", "error"]
    },
    "position": {
      "type": "object",
      "additionalProperties": false,
      "required": ["x", "y"],
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" }
      }
    },
    "workflowNode": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "kind", "position", "data"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "kind": { "$ref": "#/$defs/workflowNodeKind" },
        "position": { "$ref": "#/$defs/position" },
        "data": { "$ref": "#/$defs/workflowNodeData" }
      }
    },
    "workflowEdge": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "source", "target", "dataType"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "source": { "type": "string", "minLength": 1 },
        "target": { "type": "string", "minLength": 1 },
        "sourceHandle": { "type": ["string", "null"] },
        "targetHandle": { "type": ["string", "null"] },
        "dataType": { "$ref": "#/$defs/workflowDataType" }
      }
    },
    "workflowNodeData": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "title", "status"],
      "properties": {
        "kind": { "$ref": "#/$defs/workflowNodeKind" },
        "title": { "type": "string", "minLength": 1 },
        "status": { "$ref": "#/$defs/nodeRunStatus" },
        "content": { "type": ["string", "null"] },
        "imagePath": { "type": ["string", "null"] },
        "thumbnailPath": { "type": ["string", "null"] },
        "providerId": { "type": ["string", "null"] },
        "model": { "type": ["string", "null"] },
        "promptOverride": { "type": ["string", "null"] },
        "negativePrompt": { "type": ["string", "null"] },
        "aspectRatio": { "type": ["string", "null"] },
        "stylePreset": { "type": ["string", "null"] },
        "seed": { "type": ["string", "null"] },
        "strength": { "type": ["number", "null"] },
        "saveDirectory": { "type": ["string", "null"] },
        "lastOutputPath": { "type": ["string", "null"] },
        "resultPath": { "type": ["string", "null"] },
        "resultUrl": { "type": ["string", "null"] },
        "error": { "type": ["string", "null"] }
      }
    }
  }
}
```

## WorkflowNodeData 字段语义

所有节点共享同一个 `WorkflowNodeData` 结构。不同节点只使用其中一部分字段。

| 字段 | 类型 | 适用节点 | 说明 |
| --- | --- | --- | --- |
| `kind` | `WorkflowNodeKind` | 全部 | 节点类型。应与外层 `WorkflowNodeSnapshot.kind` 一致。 |
| `title` | `string` | 全部 | 节点标题。 |
| `status` | `NodeRunStatus` | 全部 | 运行状态。 |
| `content` | `string \| null` | `textInput` | 文本输入内容。 |
| `imagePath` | `string \| null` | `imageInput` | 导入图片的本地路径。 |
| `thumbnailPath` | `string \| null` | `imageInput` | 导入图片缩略图路径。 |
| `providerId` | `string \| null` | `textToImage`、`imageToImage` | 供应商 ID，对应 `ProviderConfig.id`。 |
| `model` | `string \| null` | `textToImage`、`imageToImage` | 模型 ID，对应 `ProviderModel.id`。 |
| `promptOverride` | `string \| null` | `textToImage`、`imageToImage` | 节点内置 prompt。连接文本输入时优先使用上游文本。 |
| `negativePrompt` | `string \| null` | `textToImage`、`imageToImage` | 预留负向提示词。当前执行器未使用。 |
| `aspectRatio` | `string \| null` | `textToImage`、`imageToImage` | 画幅比例。当前映射到固定尺寸。 |
| `stylePreset` | `string \| null` | `textToImage`、`imageToImage` | 预留风格字段。当前执行器未使用。 |
| `seed` | `string \| null` | `textToImage`、`imageToImage` | 随机种子。后端按整数解析。 |
| `strength` | `number \| null` | `imageToImage` | 图生图强度。当前执行器未使用。 |
| `saveDirectory` | `string \| null` | `output` | 输出节点保存目录。为空时仅接收上游图片路径。 |
| `lastOutputPath` | `string \| null` | `output` | 输出节点最近一次结果路径。 |
| `resultPath` | `string \| null` | `imageInput`、AI 节点 | 最近一次本地结果路径。 |
| `resultUrl` | `string \| null` | AI 节点 | 供应商返回的远程图片 URL。 |
| `error` | `string \| null` | 全部 | 最近一次运行错误。 |

## 节点和连线约束

节点类型：

```ts
type WorkflowNodeKind =
  | "textInput"
  | "imageInput"
  | "textToImage"
  | "imageToImage"
  | "output";
```

数据类型：

```ts
type WorkflowDataType = "text" | "image";
```

端口 ID：

```ts
type WorkflowHandleId = "text-out" | "image-out" | "prompt-in" | "image-in";
```

允许的连接关系：

| 来源节点 | 来源端口 | 目标节点 | 目标端口 | 数据类型 |
| --- | --- | --- | --- | --- |
| `textInput` | `text-out` | `textToImage` | `prompt-in` | `text` |
| `textInput` | `text-out` | `imageToImage` | `prompt-in` | `text` |
| `imageInput` | `image-out` | `imageToImage` | `image-in` | `image` |
| `imageInput` | `image-out` | `output` | `image-in` | `image` |
| `textToImage` | `image-out` | `imageToImage` | `image-in` | `image` |
| `textToImage` | `image-out` | `output` | `image-in` | `image` |
| `imageToImage` | `image-out` | `imageToImage` | `image-in` | `image` |
| `imageToImage` | `image-out` | `output` | `image-in` | `image` |

## ProviderConfig

`ProviderConfig[]` 保存在 `providers/config.json`，用于 AI 设置面板和后端运行 AI 节点。

```ts
type ProviderCapability = "textToImage" | "imageToImage";

type ProviderModel = {
  id: string;
  name: string;
  capability: ProviderCapability;
};

type ProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string | null;
  models: ProviderModel[];
};
```

### JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://workflow.local/schema/provider-configs.schema.json",
  "title": "ProviderConfigList",
  "type": "array",
  "items": { "$ref": "#/$defs/providerConfig" },
  "$defs": {
    "providerCapability": {
      "type": "string",
      "enum": ["textToImage", "imageToImage"]
    },
    "providerModel": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name", "capability"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string" },
        "capability": { "$ref": "#/$defs/providerCapability" }
      }
    },
    "providerConfig": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name", "baseUrl", "apiKey", "models"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "baseUrl": { "type": "string", "minLength": 1 },
        "apiKey": { "type": "string" },
        "proxyUrl": { "type": ["string", "null"] },
        "models": {
          "type": "array",
          "items": { "$ref": "#/$defs/providerModel" }
        }
      }
    }
  }
}
```

## ProviderConfig 字段语义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 稳定 ID。节点通过 `providerId` 引用它。 |
| `name` | `string` | 展示名称。 |
| `baseUrl` | `string` | OpenAI 兼容接口根地址，不需要包含 `/images/generations`。 |
| `apiKey` | `string` | Bearer Token。当前为明文落盘。 |
| `proxyUrl` | `string \| null` | 可选代理地址，例如 `http://127.0.0.1:7890`。 |
| `models` | `ProviderModel[]` | 该供应商下可选模型列表。 |

## 示例

### WorkflowSnapshot 示例

```json
{
  "nodes": [
    {
      "id": "text-1",
      "kind": "textInput",
      "position": { "x": 80, "y": 120 },
      "data": {
        "kind": "textInput",
        "title": "提示词",
        "status": "idle",
        "content": "a clean product photo of a white sneaker"
      }
    },
    {
      "id": "image-1",
      "kind": "textToImage",
      "position": { "x": 360, "y": 120 },
      "data": {
        "kind": "textToImage",
        "title": "文生图",
        "status": "idle",
        "providerId": "openai",
        "model": "gpt-image-1",
        "aspectRatio": "1:1",
        "seed": null
      }
    }
  ],
  "edges": [
    {
      "id": "edge-text-1-image-1",
      "source": "text-1",
      "target": "image-1",
      "sourceHandle": "text-out",
      "targetHandle": "prompt-in",
      "dataType": "text"
    }
  ]
}
```

### ProviderConfig 示例

```json
[
  {
    "id": "openai",
    "name": "OpenAI",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "proxyUrl": null,
    "models": [
      {
        "id": "gpt-image-1",
        "name": "GPT Image 1",
        "capability": "textToImage"
      },
      {
        "id": "gpt-image-1",
        "name": "GPT Image 1 Edit",
        "capability": "imageToImage"
      }
    ]
  }
]
```

## 变更流程

数据字段扩展时按以下顺序处理：

1. 先在本文档中补字段、字段语义、示例和 JSON Schema。
2. 更新前端 TS 类型。
3. 更新 Rust serde 类型，保持 `camelCase` JSON 字段不变。
4. 更新 `toSnapshot` / `fromSnapshot` 转换逻辑。
5. 更新后端校验、执行器和存储逻辑。
6. 运行 `npm run build` 和 `cd src-tauri && cargo check`。

除非要做破坏性版本升级，否则不要重命名已有字段；新增字段应保持可选，确保旧的 `current.json` 和 `config.json` 仍可读取。
