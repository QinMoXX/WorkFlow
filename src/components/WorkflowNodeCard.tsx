import { type MouseEvent } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { NodeImagePreview } from "./NodeImagePreview";
import { outputType, nodeSummary } from "../lib/workflowGraph";
import { WorkflowNode } from "../types/workflow";

export function WorkflowNodeCard({ id, data, selected }: NodeProps<WorkflowNode>) {
  const hasPromptInput = data.kind === "textToImage" || data.kind === "imageToImage";
  const hasImageInput = data.kind === "imageToImage" || data.kind === "output";
  const output = outputType(data.kind);
  const previewPath =
    data.kind === "imageInput"
      ? data.thumbnailPath || data.resultPath || data.imagePath
      : data.kind === "textToImage" || data.kind === "imageToImage"
        ? data.resultPath
        : undefined;
  const contextImagePath =
    data.kind === "output" ? data.lastOutputPath : data.resultPath || data.imagePath;

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("workflow:image-context-menu", {
        detail: {
          nodeId: id,
          imagePath: contextImagePath || undefined,
          x: event.clientX,
          y: event.clientY,
        },
      }),
    );
  };

  return (
    <section className={`workflow-node ${selected ? "is-selected" : ""}`} onContextMenu={handleContextMenu}>
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
