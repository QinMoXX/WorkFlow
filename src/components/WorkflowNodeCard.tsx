import { type MouseEvent, type PointerEvent } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { X } from "lucide-react";
import { NodeImagePreview } from "./NodeImagePreview";
import { outputType, nodeSummary } from "../lib/workflowGraph";
import { WorkflowNode } from "../types/workflow";
import { nodeCardCopy, runStateLabels } from "../data/mockData";

export interface ReadonlyWorkflowNodeCardProps extends NodeProps<WorkflowNode> {}

const statusClassNames: Record<WorkflowNode["data"]["status"], string> = {
  idle: "bg-text-muted",
  queued: "bg-text-muted",
  running: "bg-warning",
  success: "bg-success",
  error: "bg-danger",
  blocked: "bg-text-muted",
  cancelled: "bg-text-muted",
};

export function WorkflowNodeCard({ id, data, selected }: ReadonlyWorkflowNodeCardProps) {
  const isGroup = data.kind === "group";
  const isRunLocked = data.status === "queued" || data.status === "running";
  const hasPromptInput = data.kind === "imageGeneration" || data.kind === "textToImage" || data.kind === "imageToImage";
  const hasImageInput = data.kind === "imageGeneration" || data.kind === "imageToImage" || data.kind === "output";
  const hasInput = hasPromptInput || hasImageInput;
  const output = outputType(data.kind);
  const previewPath =
    data.kind === "imageInput"
      ? data.thumbnailPath || data.resultPath || data.imagePath
      : data.kind === "imageGeneration" || data.kind === "textToImage" || data.kind === "imageToImage"
        ? data.resultPath || data.resultUrl
        : data.kind === "output"
          ? data.lastOutputPath
        : undefined;
  const contextImagePath =
    data.kind === "output" ? data.lastOutputPath : data.resultPath || data.imagePath;

  const handleContextMenu = (event: MouseEvent) => {
    if (isRunLocked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

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

  const stopRunOverlayEvent = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const cancelNodeRun = (event: MouseEvent<HTMLButtonElement>) => {
    stopRunOverlayEvent(event);
    window.dispatchEvent(
      new CustomEvent("workflow:cancel-node-run", {
        detail: { nodeId: id },
      }),
    );
  };

  return (
    <section
      className={[
        isGroup
          ? "relative h-full w-full rounded-xl border border-dashed border-border-strong bg-panel/50 p-4"
          : "relative w-[240px] rounded-xl border bg-panel p-3 shadow-floating",
        selected && !isRunLocked
          ? "border-accent shadow-selected"
          : "border-border-default",
      ].join(" ")}
      onContextMenu={handleContextMenu}
    >
      {hasInput && (
        <>
          {hasPromptInput && (
            <Handle
              id="prompt-in"
              type="target"
              position={Position.Left}
              className="workflow-node-handle workflow-node-handle-input"
            />
          )}
          {hasImageInput && (
            <Handle
              id="image-in"
              type="target"
              position={Position.Left}
              className="workflow-node-handle workflow-node-handle-input"
            />
          )}
        </>
      )}
      <header className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 flex-none rounded-full ${statusClassNames[data.status]}`} />
        <strong className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">{data.title}</strong>
        {(data.status === "queued" || data.status === "running" || data.status === "cancelled") && (
          <span className="flex-none rounded-pill bg-control px-2 py-0.5 text-[10px] font-semibold leading-4 text-text-secondary">
            {runStateLabel(data.status)}
          </span>
        )}
      </header>
      <p className="mt-3 line-clamp-2 min-h-9 text-xs leading-[18px] text-text-secondary">{nodeSummary(data)}</p>
      <NodeImagePreview path={previewPath} label={`${data.title} ${nodeCardCopy.previewSuffix}`} />
      {data.kind === "output" && data.lastOutputPath && (
        <div className="mt-2 truncate rounded-md bg-success/10 p-2 text-[11px] leading-4 text-success" title={data.lastOutputPath}>
          {nodeCardCopy.savedPrefix}
          {data.lastOutputPath}
        </div>
      )}
      {data.kind !== "output" && data.resultPath && !previewPath && (
        <div className="mt-2 truncate rounded-md bg-success/10 p-2 text-[11px] leading-4 text-success" title={data.resultPath}>
          {data.resultPath}
        </div>
      )}
      {data.error && <div className="mt-2 truncate rounded-md bg-danger/10 p-2 text-[11px] leading-4 text-danger">{data.error}</div>}
      {isRunLocked && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-panel/70 px-4 backdrop-blur-sm"
          onClick={stopRunOverlayEvent}
          onContextMenu={stopRunOverlayEvent}
          onDoubleClick={stopRunOverlayEvent}
          onPointerDown={stopRunOverlayEvent}
        >
          <div className="text-sm font-bold text-text-primary">运行中</div>
          <button
            type="button"
            className="mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-panel/90 text-text-secondary shadow-floating transition hover:border-danger hover:text-danger"
            aria-label="取消当前节点运行"
            title="取消当前节点运行"
            onClick={cancelNodeRun}
            onPointerDown={stopRunOverlayEvent}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {output && (
        <Handle
          id={`${output}-out`}
          type="source"
          position={Position.Right}
          className="workflow-node-handle workflow-node-handle-output"
        />
      )}
    </section>
  );
}

function runStateLabel(status: WorkflowNode["data"]["status"]) {
  if (status === "queued") return runStateLabels.queued;
  if (status === "running") return runStateLabels.running;
  if (status === "cancelled") return runStateLabels.cancelled;
  return status;
}
