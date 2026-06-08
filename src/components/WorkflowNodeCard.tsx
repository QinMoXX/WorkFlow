import { Handle, NodeProps, Position } from "@xyflow/react";
import { NodeImagePreview } from "./NodeImagePreview";
import { outputType, nodeSummary } from "../lib/workflowGraph";
import { WorkflowNode } from "../types/workflow";

export function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowNode>) {
  const hasPromptInput = data.kind === "textToImage" || data.kind === "imageToImage";
  const hasImageInput = data.kind === "imageToImage" || data.kind === "output";
  const output = outputType(data.kind);
  const previewPath =
    data.kind === "imageInput"
      ? data.resultPath || data.imagePath
      : data.kind === "textToImage" || data.kind === "imageToImage"
        ? data.resultPath
        : undefined;

  return (
    <section className={`workflow-node ${selected ? "is-selected" : ""}`}>
      {hasPromptInput && (
        <Handle
          id="prompt-in"
          type="target"
          position={Position.Left}
          className="handle handle-text"
          style={{ top: hasImageInput ? 34 : 46 }}
        />
      )}
      {hasImageInput && (
        <Handle
          id="image-in"
          type="target"
          position={Position.Left}
          className="handle handle-image"
          style={{ top: hasPromptInput ? 72 : 46 }}
        />
      )}
      <header className="node-header">
        <span className={`status-dot status-${data.status}`} />
        <strong>{data.title}</strong>
      </header>
      <p>{nodeSummary(data)}</p>
      <NodeImagePreview path={previewPath} label={`${data.title} 预览`} />
      {data.kind === "output" && data.lastOutputPath && (
        <div className="node-result" title={data.lastOutputPath}>
          已保存/接收：{data.lastOutputPath}
        </div>
      )}
      {data.kind !== "output" && data.resultPath && !previewPath && (
        <div className="node-result" title={data.resultPath}>
          {data.resultPath}
        </div>
      )}
      {data.error && <div className="node-error">{data.error}</div>}
      {output && (
        <Handle
          id={`${output}-out`}
          type="source"
          position={Position.Right}
          className={`handle handle-${output}`}
        />
      )}
    </section>
  );
}
