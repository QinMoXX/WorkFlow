import { ChevronDown, Download, Expand, ImageIcon, Send, Sparkles, Wand2 } from "lucide-react";
import { ViewportPortal } from "@xyflow/react";
import { WorkflowNode, WorkflowNodeData } from "../types/workflow";

export interface ReadonlyGeneratedImageToolbarProps {
  readonly node: WorkflowNode | null;
  readonly onChange: (patch: Partial<WorkflowNodeData>) => void;
  readonly onRun: () => void;
  readonly onSaveImage: (imagePath: string) => void;
  readonly canRun: boolean;
}

const generatedImageToolbarCopy = {
  panorama: "全景",
  multiAngle: "多角度",
  lighting: "打光",
  grid: "九宫格",
  hd: "高清",
  gridSplit: "宫格切分",
  edit: "编辑",
  rerun: "重新生成",
  download: "下载",
  expand: "展开",
};

export function GeneratedImageToolbar({
  node,
  onChange,
  onRun,
  onSaveImage,
  canRun,
}: ReadonlyGeneratedImageToolbarProps) {
  if (!node || !isGeneratedImageNode(node)) return null;

  const imagePath = node.data.resultPath || node.data.resultUrl;
  const nodeWidth = node.measured?.width ?? readNumericDimension(node.style?.width, 260);
  const toolbarWidth = 704;
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
        <div className="flex h-14 w-max max-w-[calc(100vw-420px)] items-center gap-2 rounded-xl border border-border-default bg-panel-raised/95 px-3 shadow-floating backdrop-blur">
          <button
            className={toolbarTextButtonClassName}
            type="button"
            title={generatedImageToolbarCopy.panorama}
            onClick={() => onChange({ aspectRatio: "16:9", stylePreset: "panorama" })}
          >
            <ImageIcon size={18} />
            <span>{generatedImageToolbarCopy.panorama}</span>
            <span className="rounded-pill bg-new/20 px-2 py-0.5 text-xs font-bold text-new">NEW</span>
          </button>
          <ToolbarDivider />
          <button
            className={toolbarTextButtonClassName}
            type="button"
            title={generatedImageToolbarCopy.multiAngle}
            onClick={() => onChange({ stylePreset: "multi-angle" })}
          >
            <Sparkles size={18} />
            <span>{generatedImageToolbarCopy.multiAngle}</span>
          </button>
          <ToolbarDivider />
          <button
            className={toolbarTextButtonClassName}
            type="button"
            title={generatedImageToolbarCopy.lighting}
            onClick={() => onChange({ stylePreset: "lighting" })}
          >
            <Wand2 size={18} />
            <span>{generatedImageToolbarCopy.lighting}</span>
          </button>
          <ToolbarDivider />
          <ToolbarSelect
            label={generatedImageToolbarCopy.grid}
            value={node.data.stylePreset === "nine-grid" ? "nine-grid" : "single"}
            options={[
              { label: "单图", value: "single" },
              { label: generatedImageToolbarCopy.grid, value: "nine-grid" },
            ]}
            onChange={(value) => onChange({ stylePreset: value })}
          />
          <ToolbarSelect
            label={generatedImageToolbarCopy.hd}
            value={node.data.stylePreset === "hd" ? "hd" : "standard"}
            options={[
              { label: "标准", value: "standard" },
              { label: generatedImageToolbarCopy.hd, value: "hd" },
            ]}
            onChange={(value) => onChange({ stylePreset: value })}
          />
          <ToolbarSelect
            label={generatedImageToolbarCopy.gridSplit}
            value={node.data.stylePreset === "grid-split" ? "grid-split" : "none"}
            options={[
              { label: "关闭", value: "none" },
              { label: generatedImageToolbarCopy.gridSplit, value: "grid-split" },
            ]}
            onChange={(value) => onChange({ stylePreset: value === "none" ? undefined : value })}
          />
          <ToolbarDivider />
          <button
            className={toolbarIconButtonClassName}
            type="button"
            title={generatedImageToolbarCopy.edit}
            aria-label={generatedImageToolbarCopy.edit}
            onClick={() => onChange({ stylePreset: "edit" })}
          >
            <Wand2 size={19} />
          </button>
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
          <button
            className={toolbarIconButtonClassName}
            type="button"
            title={generatedImageToolbarCopy.expand}
            aria-label={generatedImageToolbarCopy.expand}
            onClick={() => onChange({ stylePreset: "expand" })}
          >
            <Expand size={20} />
          </button>
        </div>
      </div>
    </ViewportPortal>
  );
}

function ToolbarSelect({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: ReadonlyArray<{ label: string; value: string }>;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-bold text-text-primary transition hover:bg-control-hover">
      <span>{label}</span>
      <select
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="text-text-secondary" />
    </label>
  );
}

function ToolbarDivider() {
  return <span className="h-7 w-px shrink-0 bg-border-default" aria-hidden="true" />;
}

function isGeneratedImageNode(node: WorkflowNode) {
  return (
    (node.data.kind === "imageGeneration" || node.data.kind === "textToImage" || node.data.kind === "imageToImage") &&
    Boolean(node.data.resultPath || node.data.resultUrl)
  );
}

function readNumericDimension(value: unknown, fallback: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

const toolbarTextButtonClassName =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-bold text-text-primary transition hover:bg-control-hover";
const toolbarIconButtonClassName =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-primary transition hover:bg-control-hover disabled:text-text-muted";
