# WorkFlow 数据契约

本文记录当前前端 TypeScript 与后端 Rust 共享的数据结构。字段使用 camelCase。

## WorkflowProjectIndex

保存位置：

```text
appData/workflows/projects.json
```

```ts
type WorkflowProjectIndex = {
  activeProjectId: string;
  projects: WorkflowProjectSummary[];
};

type WorkflowProjectSummary = {
  id: string;
  name: string;
  assetDirName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};
```

## WorkflowProject

保存位置：

```text
appData/workflows/projects/{assetDirName}/project.json
```

```ts
type WorkflowProject = {
  id: string;
  name: string;
  assetDirName: string;
  activeCanvasId: string;
  assetRootDir?: string | null;
  canvases: WorkflowCanvas[];
};

type WorkflowCanvas = {
  id: string;
  name: string;
  assetDirName: string;
  snapshot: WorkflowSnapshot;
};
```

`assetRootDir` 和 `WorkflowCanvas.assetDirName` 保留用于旧数据兼容；当前资产目录按项目共享，不再按画布隔离。

## WorkflowSnapshot

```ts
type WorkflowSnapshot = {
  nodes: WorkflowNodeSnapshot[];
  edges: WorkflowEdgeSnapshot[];
};
```

节点类型：

```ts
type WorkflowNodeKind =
  | "textInput"
  | "imageInput"
  | "imageGeneration"
  | "textToImage"
  | "imageToImage"
  | "output"
  | "group";
```

当前新建节点只使用 `imageGeneration`。`textToImage` 和 `imageToImage` 仅用于旧数据兼容，加载时迁移为 `imageGeneration`。

运行状态：

```ts
type NodeRunStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "error"
  | "blocked"
  | "cancelled";
```

节点数据：

```ts
type WorkflowNodeData = {
  kind: WorkflowNodeKind;
  title: string;
  status: NodeRunStatus;
  content?: string;
  imagePath?: string;
  thumbnailPath?: string;
  model?: string;
  promptOverride?: string;
  negativePrompt?: string;
  aspectRatio?: string;
  stylePreset?: string;
  seed?: string;
  strength?: number;
  saveDirectory?: string;
  lastOutputPath?: string;
  resultPath?: string;
  resultUrl?: string;
  progress?: number;
  error?: string;
  groupWidth?: number;
  groupHeight?: number;
};
```

当前执行器实际使用字段：

- `content`
- `imagePath`
- `thumbnailPath`
- `model`
- `promptOverride`
- `aspectRatio`
- `seed`
- `saveDirectory`
- `lastOutputPath`
- `resultPath`
- `resultUrl`

`negativePrompt`、`stylePreset`、`strength` 暂不参与 API 请求。

## ProjectAsset

项目资产由后端扫描项目 assets 目录返回，不单独保存索引。

```ts
type ProjectAssetKind = "imported" | "generated" | "output" | "thumbnail";

type ProjectAsset = {
  id: string;
  kind: ProjectAssetKind;
  name: string;
  path: string;
  thumbnailPath?: string | null;
  sizeBytes: number;
  modifiedAt: string;
};
```

## ApiConfig

保存位置：

```text
appData/ai/config.json
```

```ts
type ApiConfig = {
  apiKey: string;
};
```

不再保存 `ProviderConfig[]`。
