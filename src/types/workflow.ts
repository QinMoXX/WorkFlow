import { Edge, Node } from "@xyflow/react";

export type WorkflowDataType = "text" | "image";

export type WorkflowNodeKind =
  | "textInput"
  | "imageInput"
  | "imageGeneration"
  | "textToImage"
  | "imageToImage"
  | "output"
  | "group";

export type NodeRunStatus = "idle" | "queued" | "running" | "success" | "error" | "blocked" | "cancelled";

export type WorkflowNodeData = {
  kind: WorkflowNodeKind;
  title: string;
  status: NodeRunStatus;
  content?: string;
  imagePath?: string;
  thumbnailPath?: string;
  providerId?: string;
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

export type WorkflowNode = Node<WorkflowNodeData, "workflowNode">;
export type WorkflowEdge = Edge<{ dataType: WorkflowDataType }>;

export type WorkflowSnapshot = {
  nodes: Array<{
    id: string;
    kind: WorkflowNodeKind;
    position: { x: number; y: number };
    parentId?: string | null;
    extent?: "parent" | null;
    data: WorkflowNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    dataType: WorkflowDataType;
  }>;
};

export type WorkflowCanvas = {
  id: string;
  name: string;
  assetDirName: string;
  snapshot: WorkflowSnapshot;
};

export type WorkflowProject = {
  id: string;
  name: string;
  assetDirName: string;
  activeCanvasId: string;
  assetRootDir?: string | null;
  canvases: WorkflowCanvas[];
};

export type WorkflowProjectSummary = {
  id: string;
  name: string;
  assetDirName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

export type WorkflowProjectIndex = {
  activeProjectId: string;
  projects: WorkflowProjectSummary[];
};

export type ProjectAssetKind = "imported" | "generated" | "output" | "thumbnail";

export type ProjectAsset = {
  id: string;
  kind: ProjectAssetKind;
  name: string;
  path: string;
  thumbnailPath?: string | null;
  sizeBytes: number;
  modifiedAt: string;
};

export type RunResponse = {
  snapshot: WorkflowSnapshot;
  logs: string[];
  runId: string;
};

export type ImportedImage = {
  imagePath: string;
  thumbnailPath?: string | null;
};

export type RunMode = "node" | "workflow";

export type RunStartedEvent = {
  runId: string;
  mode: RunMode;
  targetNodeId?: string;
  nodeIds: string[];
  startedAt: string;
};

export type RunNodeEvent = {
  runId: string;
  nodeId: string;
  status: NodeRunStatus;
  sequence: number;
  timestamp: string;
  node: {
    id: string;
    title: string;
    kind: WorkflowNodeKind;
    status: NodeRunStatus;
    resultPath?: string | null;
    resultUrl?: string | null;
    lastOutputPath?: string | null;
    progress?: number | null;
    error?: string | null;
  };
  output?: {
    dataType?: WorkflowDataType | null;
    localPath?: string | null;
    remoteUrl?: string | null;
    thumbnailPath?: string | null;
    textPreview?: string | null;
  } | null;
  error?: RunError | null;
  metrics?: RunNodeMetrics | null;
};

export type RunLogEvent = {
  runId: string;
  sequence: number;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  nodeId?: string | null;
  code?: string | null;
};

export type RunFinishedEvent = {
  runId: string;
  status: "success" | "error" | "cancelled";
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
  error?: RunError | null;
};

export type RunNodeMetrics = {
  queuedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  providerId?: string | null;
  providerName?: string | null;
  model?: string | null;
  retryCount?: number | null;
};

export type RunError = {
  kind: string;
  code: string;
  message: string;
  nodeId?: string | null;
  causeNodeId?: string | null;
  retryable: boolean;
};
