import {
  WorkflowDataType,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowSnapshot,
} from "../types/workflow";

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

export function nodeSummary(data: WorkflowNodeData) {
  if (data.kind === "textInput") return data.content || "输入 prompt 文本";
  if (data.kind === "imageInput") return data.imagePath || "选择或粘贴图片路径";
  if (data.kind === "textToImage") return `${data.providerId || "provider"} / ${data.model || "model"}`;
  if (data.kind === "imageToImage") return `strength ${data.strength ?? 0.65}`;
  return data.saveDirectory || "等待图片输入";
}

export function toSnapshot(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowSnapshot {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      position: node.position,
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
