import { Edge, Node } from "@xyflow/react";

export type WorkflowDataType = "text" | "image";

export type WorkflowNodeKind =
  | "textInput"
  | "imageInput"
  | "textToImage"
  | "imageToImage"
  | "output";

export type NodeRunStatus = "idle" | "queued" | "running" | "success" | "error";

export type WorkflowNodeData = {
  kind: WorkflowNodeKind;
  title: string;
  status: NodeRunStatus;
  content?: string;
  imagePath?: string;
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
  error?: string;
};

export type WorkflowNode = Node<WorkflowNodeData, "workflowNode">;
export type WorkflowEdge = Edge<{ dataType: WorkflowDataType }>;

export type WorkflowSnapshot = {
  nodes: Array<{
    id: string;
    kind: WorkflowNodeKind;
    position: { x: number; y: number };
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

export type RunResponse = {
  snapshot: WorkflowSnapshot;
  logs: string[];
};
