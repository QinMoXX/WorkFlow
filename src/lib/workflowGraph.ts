import {
  WorkflowDataType,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowSnapshot,
} from "../types/workflow";

export type WorkflowHandleId = "text-out" | "image-out" | "prompt-in" | "image-in";

export type WorkflowConnectionRule = {
  sourceKind: WorkflowNodeKind;
  sourceHandle: WorkflowHandleId;
  targetKind: WorkflowNodeKind;
  targetHandle: WorkflowHandleId;
  dataType: WorkflowDataType;
};

export const connectionRules: WorkflowConnectionRule[] = [
  {
    sourceKind: "textInput",
    sourceHandle: "text-out",
    targetKind: "textToImage",
    targetHandle: "prompt-in",
    dataType: "text",
  },
  {
    sourceKind: "textInput",
    sourceHandle: "text-out",
    targetKind: "imageToImage",
    targetHandle: "prompt-in",
    dataType: "text",
  },
  {
    sourceKind: "imageInput",
    sourceHandle: "image-out",
    targetKind: "imageToImage",
    targetHandle: "image-in",
    dataType: "image",
  },
  {
    sourceKind: "imageInput",
    sourceHandle: "image-out",
    targetKind: "output",
    targetHandle: "image-in",
    dataType: "image",
  },
  {
    sourceKind: "textToImage",
    sourceHandle: "image-out",
    targetKind: "imageToImage",
    targetHandle: "image-in",
    dataType: "image",
  },
  {
    sourceKind: "textToImage",
    sourceHandle: "image-out",
    targetKind: "output",
    targetHandle: "image-in",
    dataType: "image",
  },
  {
    sourceKind: "imageToImage",
    sourceHandle: "image-out",
    targetKind: "imageToImage",
    targetHandle: "image-in",
    dataType: "image",
  },
  {
    sourceKind: "imageToImage",
    sourceHandle: "image-out",
    targetKind: "output",
    targetHandle: "image-in",
    dataType: "image",
  },
];

export function outputType(kind: WorkflowNodeKind): WorkflowDataType | null {
  if (kind === "textInput") return "text";
  if (kind === "imageInput" || kind === "textToImage" || kind === "imageToImage") {
    return "image";
  }
  return null;
}

export function inputType(handleId: string | null | undefined): WorkflowDataType | null {
  if (handleId === "prompt-in") return "text";
  if (handleId === "image-in") return "image";
  return null;
}

export function findConnectionRule(
  sourceKind: WorkflowNodeKind,
  sourceHandle: string | null | undefined,
  targetKind: WorkflowNodeKind,
  targetHandle: string | null | undefined,
): WorkflowConnectionRule | null {
  return (
    connectionRules.find(
      (rule) =>
        rule.sourceKind === sourceKind &&
        rule.sourceHandle === sourceHandle &&
        rule.targetKind === targetKind &&
        rule.targetHandle === targetHandle,
    ) ?? null
  );
}

export function nodeSummary(data: WorkflowNodeData) {
  if (data.kind === "textInput") return data.content || "输入 prompt 文本";
  if (data.kind === "imageInput") return data.imagePath || "选择或粘贴图片路径";
  if (data.kind === "textToImage") return `${data.providerId || "provider"} / ${data.model || "model"}`;
  if (data.kind === "imageToImage") return `strength ${data.strength ?? 0.65}`;
  if (data.kind === "group") return "视觉分组，不参与执行语义";
  return data.saveDirectory ? `保存到 ${data.saveDirectory}` : "等待图片输入";
}

export function toSnapshot(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowSnapshot {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      position: node.position,
      parentId: node.parentId,
      extent: node.extent === "parent" ? "parent" : null,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      dataType: edge.data?.dataType ?? "image",
    })),
  };
}

export function fromSnapshot(snapshot: WorkflowSnapshot): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  return {
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      type: "workflowNode",
      position: node.position,
      parentId: node.parentId ?? undefined,
      extent: node.extent === "parent" ? "parent" : undefined,
      style:
        node.data.kind === "group"
          ? {
              width: node.data.groupWidth ?? 520,
              height: node.data.groupHeight ?? 320,
            }
          : undefined,
      data: node.data,
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: { dataType: edge.dataType },
    })),
  };
}
