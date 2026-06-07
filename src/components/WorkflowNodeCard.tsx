import { Handle, NodeProps, Position } from "@xyflow/react";
import { outputType, nodeSummary } from "../lib/workflowGraph";
import { WorkflowNode } from "../types/workflow";

export function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowNode>) {
  const hasPromptInput = data.kind === "textToImage" || data.kind === "imageToImage";
  const hasImageInput = data.kind === "imageToImage" || data.kind === "output";
  const output = outputType(data.kind);

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
      {(data.resultPath || data.lastOutputPath) && (
        <div className="node-result">{data.resultPath || data.lastOutputPath}</div>
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
