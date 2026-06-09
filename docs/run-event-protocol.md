# 运行事件协议

本文定义 WorkFlow 运行时由 Rust/Tauri 后端推送给 React 前端的事件协议。目标是补齐 `docs/workflow-design.md` 中“每个节点完成后，Rust 通过 Tauri event 推送状态与结果”的要求，并替代当前仅在 `run_nodes` 内部修改状态、最后一次性返回 `RunResponse` 的交互方式。

协议重点：

- 前端通过 Tauri command 只负责发起运行。
- 后端负责依赖解析、节点执行、文件写入和事件推送。
- 前端通过 Tauri event 实时刷新节点状态、日志和结果预览。
- 长任务执行不能阻塞 UI 事件循环。

## 事件命名

事件名使用稳定的命名空间前缀 `workflow://run/`，所有 payload 字段使用 camelCase。

| 事件名 | 触发时机 | 用途 |
| --- | --- | --- |
| `workflow://run/started` | 一次运行开始后 | 初始化本次运行状态，标记运行范围内节点为 `queued` |
| `workflow://run/node` | 单个节点状态变化时 | 推送节点 `queued`、`running`、`success`、`error`、`blocked` 状态 |
| `workflow://run/log` | 产生运行日志时 | 追加结构化日志，不依赖最终 `RunResponse.logs` |
| `workflow://run/finished` | 一次运行结束后 | 告知前端本次运行完成、失败或取消，并给出最终摘要 |

第一版可以只实现 `workflow://run/node` 和 `workflow://run/finished`，但字段结构应按本文保持兼容。

## 运行 ID

每次 `run_node` 或 `run_workflow` 调用必须生成一个 `runId`，并在本次运行的所有事件中携带。

建议格式：

```text
run-{unixMillis}-{shortRandom}
```

前端必须用 `runId` 过滤过期事件，避免用户连续点击运行时旧事件覆盖新状态。

## 节点状态

节点状态在设计文档已有基础上增加 `blocked`，用于表达上游失败导致本节点未执行。

```ts
export type NodeRunStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "error"
  | "blocked";
```

状态含义：

| 状态 | 含义 | 前端行为 |
| --- | --- | --- |
| `idle` | 未参与当前运行，或运行状态已被清空 | 显示默认状态 |
| `queued` | 已进入本次执行队列，尚未开始执行 | 显示等待状态 |
| `running` | 后端正在执行该节点 | 显示运行中状态，可展示 loading |
| `success` | 节点执行完成且产生有效输出或通过校验 | 更新结果路径、预览和日志 |
| `error` | 节点执行失败 | 显示错误状态和错误信息 |
| `blocked` | 上游节点失败，本节点被跳过 | 显示未执行或阻塞提示 |

合法状态流转：

```text
idle -> queued -> running -> success
idle -> queued -> running -> error
idle -> queued -> blocked
```

`blocked` 只能由后端根据依赖关系发出，前端不自行推断。

## Payload 结构

### RunStartedEvent

```ts
export type RunMode = "node" | "workflow";

export type RunStartedEvent = {
  runId: string;
  mode: RunMode;
  targetNodeId?: string;
  nodeIds: string[];
  startedAt: string;
};
```

字段说明：

- `runId`：本次运行唯一 ID。
- `mode`：`node` 表示运行单节点及其必要上游，`workflow` 表示运行全部。
- `targetNodeId`：单节点运行时的目标节点 ID。
- `nodeIds`：本次运行计划涉及的节点 ID，按执行顺序排列。
- `startedAt`：ISO 8601 时间。

### RunNodeEvent

```ts
export type RunNodeEvent = {
  runId: string;
  nodeId: string;
  status: NodeRunStatus;
  sequence: number;
  timestamp: string;
  node?: RunNodeSnapshot;
  output?: RunNodeOutput;
  error?: RunError;
  metrics?: RunNodeMetrics;
};
```

字段说明：

- `sequence`：本次运行内单调递增序号。前端可用它处理乱序事件。
- `node`：节点状态快照，优先只放前端刷新所需字段，不发送完整 workflow snapshot。
- `output`：成功时的输出摘要。
- `error`：失败或阻塞时的错误结构。
- `metrics`：节点耗时、供应商、模型等指标。

```ts
export type RunNodeSnapshot = {
  id: string;
  title: string;
  kind: WorkflowNodeKind;
  status: NodeRunStatus;
  resultPath?: string;
  resultUrl?: string;
  lastOutputPath?: string;
  error?: string;
};

export type RunNodeOutput = {
  dataType?: WorkflowDataType;
  localPath?: string;
  remoteUrl?: string;
  thumbnailPath?: string;
  textPreview?: string;
};

export type RunNodeMetrics = {
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  providerId?: string;
  providerName?: string;
  model?: string;
  retryCount?: number;
};
```

### RunLogEvent

日志必须结构化，避免前端解析自然语言字符串。

```ts
export type RunLogLevel = "debug" | "info" | "warn" | "error";

export type RunLogEvent = {
  runId: string;
  sequence: number;
  timestamp: string;
  level: RunLogLevel;
  message: string;
  nodeId?: string;
  code?: string;
  details?: Record<string, string | number | boolean | null>;
};
```

约束：

- `message` 面向用户展示，应简短可读。
- `details` 面向调试和后续日志面板筛选，不放 API Key、完整请求体或 base64 图片。
- 同一节点的成功日志应包含供应商、模型、耗时和结果路径。

### RunFinishedEvent

```ts
export type RunFinalStatus = "success" | "error" | "cancelled";

export type RunFinishedEvent = {
  runId: string;
  status: RunFinalStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: {
    total: number;
    success: number;
    error: number;
    blocked: number;
    skipped: number;
  };
  error?: RunError;
};
```

`RunResponse` 可以暂时保留，用于 command 返回最终 snapshot，兼容现有调用；但前端实时 UI 刷新应以事件为准。

## 错误结构

错误结构统一用于节点失败、运行失败、阻塞原因和日志。

```ts
export type RunErrorKind =
  | "validation"
  | "providerConfig"
  | "providerRequest"
  | "network"
  | "fileSystem"
  | "unsupported"
  | "cancelled"
  | "internal";

export type RunError = {
  kind: RunErrorKind;
  code: string;
  message: string;
  nodeId?: string;
  causeNodeId?: string;
  retryable: boolean;
  details?: Record<string, string | number | boolean | null>;
};
```

字段说明：

- `kind`：错误分类，用于前端展示和筛选。
- `code`：稳定错误码，例如 `missingPrompt`、`imageInputNotFound`、`providerModelUnsupported`。
- `message`：可直接展示给用户的中文错误信息。
- `nodeId`：当前失败节点。
- `causeNodeId`：阻塞状态下导致本节点跳过的上游节点。
- `retryable`：是否适合提示用户重试。
- `details`：可选调试信息，不得包含密钥、完整图片 base64 或大体积响应。

## 示例

一次完整工作流运行中，后端可按以下顺序发事件：

```json
{
  "event": "workflow://run/started",
  "payload": {
    "runId": "run-1781025600000-a1b2",
    "mode": "workflow",
    "nodeIds": ["text-1", "image-1", "output-1"],
    "startedAt": "2026-06-09T14:40:00.000Z"
  }
}
```

```json
{
  "event": "workflow://run/node",
  "payload": {
    "runId": "run-1781025600000-a1b2",
    "nodeId": "image-1",
    "status": "running",
    "sequence": 4,
    "timestamp": "2026-06-09T14:40:02.120Z",
    "node": {
      "id": "image-1",
      "title": "文生图",
      "kind": "textToImage",
      "status": "running"
    },
    "metrics": {
      "providerId": "agnes",
      "providerName": "Agnes AI",
      "model": "agnes-image-2.0-flash",
      "startedAt": "2026-06-09T14:40:02.120Z"
    }
  }
}
```

```json
{
  "event": "workflow://run/node",
  "payload": {
    "runId": "run-1781025600000-a1b2",
    "nodeId": "image-1",
    "status": "success",
    "sequence": 5,
    "timestamp": "2026-06-09T14:40:17.800Z",
    "node": {
      "id": "image-1",
      "title": "文生图",
      "kind": "textToImage",
      "status": "success",
      "resultPath": "C:\\Users\\user\\AppData\\Roaming\\com.qm.workflow-app\\assets\\generated\\image-1.png",
      "resultUrl": "https://example.com/result.png"
    },
    "output": {
      "dataType": "image",
      "localPath": "C:\\Users\\user\\AppData\\Roaming\\com.qm.workflow-app\\assets\\generated\\image-1.png",
      "remoteUrl": "https://example.com/result.png"
    },
    "metrics": {
      "providerId": "agnes",
      "providerName": "Agnes AI",
      "model": "agnes-image-2.0-flash",
      "durationMs": 15680
    }
  }
}
```

失败时：

```json
{
  "event": "workflow://run/node",
  "payload": {
    "runId": "run-1781025600000-a1b2",
    "nodeId": "image-1",
    "status": "error",
    "sequence": 5,
    "timestamp": "2026-06-09T14:40:17.800Z",
    "error": {
      "kind": "validation",
      "code": "missingPrompt",
      "message": "缺少 prompt 输入",
      "nodeId": "image-1",
      "retryable": false
    }
  }
}
```

下游阻塞时：

```json
{
  "event": "workflow://run/node",
  "payload": {
    "runId": "run-1781025600000-a1b2",
    "nodeId": "output-1",
    "status": "blocked",
    "sequence": 6,
    "timestamp": "2026-06-09T14:40:17.810Z",
    "error": {
      "kind": "validation",
      "code": "upstreamFailed",
      "message": "上游节点失败，当前节点未执行",
      "nodeId": "output-1",
      "causeNodeId": "image-1",
      "retryable": false
    }
  }
}
```

## 状态刷新规则

前端状态刷新必须遵守以下规则：

1. 收到 `workflow://run/started` 后，仅更新 `nodeIds` 中节点为 `queued`，不要重置未参与运行的节点结果。
2. 收到 `workflow://run/node` 后，只 patch 对应节点的 `data.status`、`data.error`、`data.resultPath`、`data.resultUrl`、`data.lastOutputPath` 等运行字段。
3. 前端不得用事件 payload 替换整张画布，节点位置、选中状态、临时 UI 状态仍由 React Flow / 前端 store 管理。
4. 如果事件 `runId` 不是当前活动运行，直接忽略。
5. 如果同一节点收到更小的 `sequence`，直接忽略，避免乱序事件回滚状态。
6. `RunResponse.snapshot` 返回后只作为最终一致性校验或兜底同步，不作为实时刷新的唯一来源。

## 前后端分离边界

后端职责：

- 生成 `runId` 和事件 `sequence`。
- 计算执行顺序和依赖阻塞关系。
- 执行节点、调用 Provider、读写文件。
- 发送节点状态、日志、错误和最终摘要。
- 保证 payload 不暴露 API Key、完整请求体和大体积图片内容。

前端职责：

- 调用 `run_node` 或 `run_workflow` 发起运行。
- 订阅并过滤事件。
- 用事件 patch UI 状态、日志面板和节点预览。
- 禁止在前端重新实现依赖解析、Provider 调用和文件写入。

## 异步与非阻塞要求

当前 `run_node` / `run_workflow` 是同步 Tauri command。后续实现事件推送时，应调整为异步命令或在后端任务中执行运行逻辑：

```rust
#[tauri::command]
pub async fn run_workflow(app: AppHandle, snapshot: WorkflowSnapshot) -> Result<RunResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // validate -> load providers -> run_nodes_with_events
    })
    .await
    .map_err(|error| error.to_string())?
}
```

约束：

- 文件读写、图片编码、网络请求和长耗时 Provider 调用不得阻塞主线程。
- 事件发射使用 `AppHandle::emit` 或窗口级 `emit`，失败时写入后端日志，但不应导致节点执行崩溃。
- 同一节点的事件顺序由后端保证：`queued` -> `running` -> `success/error/blocked`。
- command 可以继续返回最终 `RunResponse`，但 UI 不应等待该返回值才显示进度。

## 性能优化

事件 payload 应小而稳定：

- 不发送完整 `WorkflowSnapshot`。
- 不发送 base64 图片、大请求体、大响应体或完整 provider 原始响应。
- 图片结果只发送本地路径、远程 URL、缩略图路径等引用。
- 高频日志需要节流。第一版只在节点状态变化和节点完成时发日志。
- `sequence` 使用运行内递增整数，前端无需按时间字符串排序。
- `details` 只放短字段，例如状态码、耗时、模型名、文件路径。

大工作流建议：

- `started` 事件一次性发送执行计划，前端批量标记 `queued`。
- 节点完成后只 patch 单节点，避免重渲染整张画布。
- 日志列表前端做最大条数限制或虚拟滚动。
- 后端可在运行结束时统一保存最终 workflow snapshot，避免每个节点完成都写一次磁盘。

## 与现有实现的迁移关系

现有实现位于 `src-tauri/src/workflow/executor.rs`：

- `run_nodes` 内部直接修改 `snapshot.nodes[index].data.status`。
- 成功或失败日志以 `Vec<String>` 返回。
- 前端必须等待 `RunResponse` 才能看到最终状态。

建议迁移顺序：

1. 在前后端类型中补充 `blocked`、结构化日志和结构化错误。
2. 为 `run_nodes` 增加事件发射上下文，例如 `RunEventEmitter`。
3. 在执行前发 `started` 和所有节点 `queued`。
4. 每个节点开始前发 `running`，成功后发 `success`，失败后发 `error`。
5. 上游失败后，为未执行下游发 `blocked`。
6. 前端订阅事件并用 `runId`、`sequence` patch 节点状态。
7. 保留 `RunResponse` 作为最终兜底，后续再考虑精简为只返回 `runId` 和最终摘要。
