import { Crop, Download, Send } from "lucide-react";
import { ViewportPortal } from "@xyflow/react";
import { WorkflowNode } from "../types/workflow";

export interface ReadonlyGeneratedImageToolbarProps {
  readonly node: WorkflowNode | null;
  readonly onRun: () => void;
  readonly onSaveImage: (imagePath: string) => void;
  readonly onCropImage: (imagePath: string) => void;
  readonly canRun: boolean;
}

const generatedImageToolbarCopy = {
  rerun: "重新生成",
  crop: "裁剪",
  download: "下载",
};

export function GeneratedImageToolbar({
  node,
  onRun,
  onSaveImage,
  onCropImage,
  canRun,
}: ReadonlyGeneratedImageToolbarProps) {
  if (!node || !nodeResultImagePath(node)) return null;

  const imagePath = nodeResultImagePath(node);
  const canRerun = isGeneratedImageNode(node);
  const nodeWidth = node.measured?.width ?? readNumericDimension(node.style?.width, 260);
  const toolbarWidth = canRerun ? 148 : 108;
  const left = node.position.x + nodeWidth / 2 - toolbarWidth / 2;
  const top = node.position.y - 72;

  return (
    <ViewportPortal>
      <div
        className="nodrag nopan pointer-events-auto absolute z-30"
        style={{ left, top }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 w-max items-center gap-2 rounded-xl border border-border-default bg-panel-raised/95 px-3 shadow-floating backdrop-blur">
          {canRerun && (
            <button
              className={toolbarIconButtonClassName}
              type="button"
              title={generatedImageToolbarCopy.rerun}
              aria-label={generatedImageToolbarCopy.rerun}
              onClick={onRun}
              disabled={!canRun}
            >
              <Send size={18} />
            </button>
          )}
          <button
            className={toolbarIconButtonClassName}
            type="button"
            title={generatedImageToolbarCopy.crop}
            aria-label={generatedImageToolbarCopy.crop}
            onClick={() => imagePath && onCropImage(imagePath)}
            disabled={!imagePath}
          >
            <Crop size={19} />
          </button>
          <button
            className={toolbarIconButtonClassName}
            type="button"
            title={generatedImageToolbarCopy.download}
            aria-label={generatedImageToolbarCopy.download}
            onClick={() => imagePath && onSaveImage(imagePath)}
            disabled={!imagePath}
          >
            <Download size={20} />
          </button>
        </div>
      </div>
    </ViewportPortal>
  );
}

function nodeResultImagePath(node: WorkflowNode) {
  if (node.data.kind === "output") return node.data.lastOutputPath;
  return node.data.resultPath || node.data.imagePath;
}

function isGeneratedImageNode(node: WorkflowNode) {
  return (
    (node.data.kind === "imageGeneration" || node.data.kind === "textToImage" || node.data.kind === "imageToImage") &&
    Boolean(node.data.resultPath)
  );
}

function readNumericDimension(value: unknown, fallback: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

const toolbarIconButtonClassName =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-primary transition hover:bg-control-hover disabled:text-text-muted";
