import { WorkflowEdge, WorkflowNode, WorkflowNodeData, WorkflowNodeKind } from "../types/workflow";
import { nodeTemplates } from "../data/mockData";

export { nodeTemplates };

export const initialNodes: WorkflowNode[] = [
  {
    id: "text-1",
    type: "workflowNode",
    position: { x: 80, y: 120 },
    data: {
      kind: "textInput",
      title: "文本输入",
      status: "idle",
      content: "A clean product photo of a ceramic coffee cup",
    },
  },
  {
    id: "generate-1",
    type: "workflowNode",
    position: { x: 420, y: 96 },
    data: {
      kind: "textToImage",
      title: "文生图",
      status: "idle",
      providerId: "openai",
      model: "gpt-image-1",
      aspectRatio: "1:1",
      stylePreset: "product",
    },
  },
  {
    id: "output-1",
    type: "workflowNode",
    position: { x: 760, y: 132 },
    data: {
      kind: "output",
      title: "输出",
      status: "idle",
    },
  },
];

export const initialEdges: WorkflowEdge[] = [
  {
    id: "text-1-generate-1",
    source: "text-1",
    target: "generate-1",
    sourceHandle: "text-out",
    targetHandle: "prompt-in",
    data: { dataType: "text" },
  },
  {
    id: "generate-1-output-1",
    source: "generate-1",
    target: "output-1",
    sourceHandle: "image-out",
    targetHandle: "image-in",
    data: { dataType: "image" },
  },
];

export function createNode(kind: WorkflowNodeKind, index: number): WorkflowNode {
  const template = nodeTemplates.find((item) => item.kind === kind)!;
  const baseData: WorkflowNodeData = {
    kind,
    title: template.title,
    status: "idle",
  };

  if (kind === "textInput") baseData.content = "";
  if (kind === "imageInput") baseData.imagePath = "";
  if (kind === "textToImage") {
    baseData.providerId = "openai";
    baseData.model = "gpt-image-1";
    baseData.aspectRatio = "1:1";
  }
  if (kind === "imageToImage") {
    baseData.providerId = "openai";
    baseData.model = "gpt-image-1";
    baseData.strength = 0.65;
    baseData.aspectRatio = "1:1";
  }
  if (kind === "group") {
    baseData.groupWidth = 520;
    baseData.groupHeight = 320;
  }

  return {
    id: `${kind}-${Date.now()}`,
    type: "workflowNode",
    position: { x: 120 + index * 34, y: 120 + index * 28 },
    style: kind === "group" ? { width: 520, height: 320 } : undefined,
    data: baseData,
  };
}
