import { Box, Camera, ChevronDown, Expand, ImageIcon, Map, Send, Sparkles } from "lucide-react";
import { ViewportPortal } from "@xyflow/react";
import { WorkflowNode, WorkflowNodeData } from "../types/workflow";
import { modelsForNode } from "../lib/modelCatalog";
import {
  aspectRatioOptions,
  nodeSettingsPopoverCopy,
  propertyPanelCopy,
} from "../data/mockData";

export interface ReadonlyNodeSettingsPopoverProps {
  readonly node: WorkflowNode | null;
  readonly onChange: (patch: Partial<WorkflowNodeData>) => void;
  readonly onImportImage: (file: File) => void;
  readonly onRun: () => void;
  readonly onCancelRun: () => void;
  readonly canRun: boolean;
  readonly canCancelRun: boolean;
  readonly isCancellingRun: boolean;
}

export function NodeSettingsPopover({
  node,
  onChange,
  onImportImage,
  onRun,
  onCancelRun,
  canRun,
  canCancelRun,
  isCancellingRun,
}: ReadonlyNodeSettingsPopoverProps) {
  if (!node) return null;

  const data = node.data;
  const selectableModels = modelsForNode(data.kind);
  const nodeHeight = node.measured?.height ?? readNumericDimension(node.style?.height, 160);
  const nodeWidth = node.measured?.width ?? readNumericDimension(node.style?.width, 240);
  const popoverWidth = 800;
  const left = node.position.x + nodeWidth / 2 - popoverWidth / 2;
  const top = node.position.y + nodeHeight + 18;

  const runLabel = canCancelRun
    ? isCancellingRun
      ? propertyPanelCopy.cancelling
      : propertyPanelCopy.cancel
    : canRun
      ? nodeSettingsPopoverCopy.sendButtonLabel
      : propertyPanelCopy.running;

  return (
    <ViewportPortal>
      <section
        className="nodrag nopan pointer-events-auto absolute z-20 w-[800px] max-w-[calc(100vw-420px)] rounded-xl border border-border-default bg-panel-raised/95 p-4 shadow-panel backdrop-blur"
        style={{ left, top }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <button className={modeButtonClassName} type="button">
              <Box size={17} />
              {nodeSettingsPopoverCopy.modeStyle}
            </button>
            <button className={modeButtonClassName} type="button">
              <Map size={17} />
              {nodeSettingsPopoverCopy.modeMark}
            </button>
            {(data.imagePath || data.resultPath) && (
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-border-default bg-control">
                <ImageIcon size={18} className="text-text-muted" />
              </div>
            )}
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
            type="button"
            aria-label={nodeSettingsPopoverCopy.expandLabel}
          >
            <Expand size={17} />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-semibold text-text-secondary">
            {propertyPanelCopy.name}
            <input
              className={inputClassName}
              value={data.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </label>

          {data.kind === "textInput" && (
            <textarea
              className={`${inputClassName} min-h-28 resize-none`}
              value={data.content ?? ""}
              placeholder={nodeSettingsPopoverCopy.promptPlaceholder}
              onChange={(event) => onChange({ content: event.target.value })}
            />
          )}

          {data.kind === "imageInput" && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-border-default bg-control px-3 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary">
                {propertyPanelCopy.chooseImage}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImportImage(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <input
                className={inputClassName}
                value={data.imagePath ?? ""}
                placeholder={propertyPanelCopy.imagePathPlaceholder}
                onChange={(event) =>
                  onChange({
                    imagePath: event.target.value,
                    thumbnailPath: undefined,
                    resultPath: event.target.value,
                  })
                }
              />
            </div>
          )}

          {(data.kind === "textToImage" || data.kind === "imageToImage") && (
            <textarea
              className={`${inputClassName} min-h-24 resize-none`}
              value={data.promptOverride ?? ""}
              placeholder={nodeSettingsPopoverCopy.promptPlaceholder}
              onChange={(event) => onChange({ promptOverride: event.target.value })}
            />
          )}

          {data.kind === "output" && (
            <input
              className={inputClassName}
              value={data.saveDirectory ?? ""}
              placeholder={propertyPanelCopy.saveDirectory}
              onChange={(event) => onChange({ saveDirectory: event.target.value })}
            />
          )}
        </div>

        <footer className="mt-5 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-3 text-sm text-text-secondary">
          {(data.kind === "textToImage" || data.kind === "imageToImage") && (
            <>
              <label className={footerSelectClassName}>
                <Sparkles className="shrink-0" size={16} />
                <select
                  className={footerModelSelectInputClassName}
                  value={data.model ?? ""}
                  onChange={(event) => onChange({ model: event.target.value })}
                >
                  {selectableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className={footerSelectIconClassName} size={14} />
              </label>
              <label className={footerSelectClassName}>
                <select
                  className={footerAspectSelectInputClassName}
                  value={data.aspectRatio ?? "1:1"}
                  onChange={(event) => onChange({ aspectRatio: event.target.value })}
                >
                  {aspectRatioOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className={footerSelectIconClassName} size={14} />
              </label>
            </>
          )}

          {data.kind === "imageToImage" && (
            <label className="flex items-center gap-2">
              {propertyPanelCopy.strength}
              <input
                className="w-24 accent-accent"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={data.strength ?? 0.65}
                onChange={(event) => onChange({ strength: Number(event.target.value) })}
              />
              <span>{data.strength ?? 0.65}</span>
            </label>
          )}

          <span className="ml-auto inline-flex items-center gap-2">
            <Camera size={16} />
            {nodeSettingsPopoverCopy.cameraLabel}
          </span>
          <span>{nodeSettingsPopoverCopy.sceneLabel}</span>
          <span>{nodeSettingsPopoverCopy.countLabel}</span>
          <span className="text-text-muted">{nodeSettingsPopoverCopy.stepLabel}</span>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg bg-inverse text-text-inverse transition hover:bg-text-primary"
            type="button"
            onClick={canCancelRun ? onCancelRun : onRun}
            disabled={data.kind === "group" || (!canRun && !canCancelRun) || isCancellingRun}
            aria-label={runLabel}
            title={runLabel}
          >
            <Send size={18} />
          </button>
        </footer>
      </section>
    </ViewportPortal>
  );
}

const modeButtonClassName =
  "grid min-w-14 gap-1 rounded-lg border border-border-default bg-control px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary";
const inputClassName =
  "w-full rounded-lg border border-border-default bg-control px-3 py-2 text-sm font-normal text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";
const footerSelectClassName =
  "relative inline-flex h-9 items-center gap-2 rounded-lg border border-border-default bg-control px-3 text-sm font-semibold text-text-primary transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 hover:border-border-strong";
const footerSelectInputClassName =
  "min-w-0 appearance-none truncate border-0 bg-transparent p-0 text-sm font-semibold text-text-primary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0";
const footerModelSelectInputClassName = `${footerSelectInputClassName} w-44 pr-6`;
const footerAspectSelectInputClassName = `${footerSelectInputClassName} w-16 pr-6 text-center`;
const footerSelectIconClassName = "pointer-events-none absolute right-3 shrink-0 text-text-muted";

function readNumericDimension(value: unknown, fallback: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}
