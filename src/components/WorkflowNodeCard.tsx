import { type MouseEvent, type PointerEvent } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Download, FileText, ImageIcon, Layers, Sparkles, X, type LucideIcon } from "lucide-react";
import { NodeImagePreview } from "./NodeImagePreview";
import { outputType } from "../lib/workflowGraph";
import { WorkflowNode } from "../types/workflow";
import { nodeCardCopy } from "../data/mockData";

export interface ReadonlyWorkflowNodeCardProps extends NodeProps<WorkflowNode> {}

const nodeTitleIcons: Record<WorkflowNode["data"]["kind"], LucideIcon> = {
  textInput: FileText,
  imageInput: ImageIcon,
  imageGeneration: Sparkles,
  textToImage: Sparkles,
  imageToImage: Sparkles,
  output: Download,
  group: Layers,
};

export function WorkflowNodeCard({ id, data, selected }: ReadonlyWorkflowNodeCardProps) {
  const isGroup = data.kind === "group";
  const TitleIcon = nodeTitleIcons[data.kind];
  const isRunLocked = data.status === "queued" || data.status === "running";
  const hasPromptInput = data.kind === "imageGeneration" || data.kind === "textToImage" || data.kind === "imageToImage";
  const hasImageInput = data.kind === "imageGeneration" || data.kind === "imageToImage" || data.kind === "output";
  const hasInput = hasPromptInput || hasImageInput;
  const output = outputType(data.kind);
  const previewPath =
    data.kind === "imageInput"
      ? data.thumbnailPath || data.resultPath || data.imagePath
      : data.kind === "imageGeneration" || data.kind === "textToImage" || data.kind === "imageToImage"
        ? data.resultPath
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
          : "relative w-[260px] rounded-xl border bg-transparent p-2 shadow-floating",
        selected && !isRunLocked
          ? "border-accent shadow-selected"
          : isGroup
            ? "border-border-default"
            : "border-transparent",
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
      <header className="flex min-h-8 items-center gap-2 px-2 pb-2">
        <TitleIcon className="h-4 w-4 flex-none text-text-muted" strokeWidth={2} aria-hidden="true" />
        <strong className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">{data.title}</strong>
      </header>
      {!isGroup && (
        <div className="min-h-[92px] rounded-lg border border-border-default bg-canvas/80 p-2">
          {data.error ? (
            <div className="line-clamp-3 rounded-md bg-danger/10 p-2 text-xs leading-5 text-danger">{data.error}</div>
          ) : isImageContentNode(data.kind) ? (
            previewPath ? (
              <NodeImagePreview path={previewPath} label={`${data.title} ${nodeCardCopy.previewSuffix}`} />
            ) : (
              <div className="grid aspect-[4/3] place-items-center rounded-md border border-dashed border-border-subtle bg-panel/60 px-3 text-center text-xs leading-5 text-text-muted">
                {emptyImageContent(data.kind)}
              </div>
            )
          ) : (
            <p className="line-clamp-5 min-h-[72px] whitespace-pre-wrap text-xs leading-5 text-text-secondary">
              {textNodeContent(data)}
            </p>
          )}
        </div>
      )}
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

function isImageContentNode(kind: WorkflowNode["data"]["kind"]) {
  return kind === "imageInput" || kind === "imageGeneration" || kind === "textToImage" || kind === "imageToImage" || kind === "output";
}

function textNodeContent(data: WorkflowNode["data"]) {
  if (data.kind === "textInput") return data.content || "输入 prompt 文本";
  return "视觉分组，不参与执行语义";
}

function emptyImageContent(kind: WorkflowNode["data"]["kind"]) {
  if (kind === "imageInput") return "选择图片后显示";
  if (kind === "output") return "等待图片输入";
  return "等待图片生成";
}
