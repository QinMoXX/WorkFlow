import { Box, Camera, ChevronDown, Expand, ImageIcon, Map, Send, Sparkles } from "lucide-react";
import { ViewportPortal } from "@xyflow/react";
import { ProviderConfig } from "../types/provider";
import { WorkflowNode, WorkflowNodeData } from "../types/workflow";
import { providerCapabilityForNode } from "../lib/providerPresets";
import {
  aspectRatioOptions,
  nodeSettingsPopoverCopy,
  propertyPanelCopy,
} from "../data/mockData";

export interface ReadonlyNodeSettingsPopoverProps {
  readonly node: WorkflowNode | null;
  readonly providers: ProviderConfig[];
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
  providers,
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
  const providerCapability = providerCapabilityForNode(data.kind);
  const selectableProviders = providerCapability
    ? providers.filter((provider) => provider.models.some((model) => model.capability === providerCapability))
    : [];
  const selectedProvider = providers.find((provider) => provider.id === data.providerId) ?? null;
  const selectableModels =
    selectedProvider && providerCapability
      ? selectedProvider.models.filter((model) => model.capability === providerCapability)
      : [];
  const nodeHeight = node.measured?.height ?? readNumericDimension(node.style?.height, 160);
  const nodeWidth = node.measured?.width ?? readNumericDimension(node.style?.width, 240);
  const popoverWidth = 800;
  const left = node.position.x + nodeWidth / 2 - popoverWidth / 2;
  const top = node.position.y + nodeHeight + 18;

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId);
    const model = provider?.models.find((item) => item.capability === providerCapability);
    onChange({ providerId, model: model?.id ?? "" });
  };

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
                <Sparkles size={16} />
                <select
                  className={footerSelectInputClassName}
                  value={data.providerId ?? ""}
                  onChange={(event) => handleProviderChange(event.target.value)}
                >
                  <option value="">{nodeSettingsPopoverCopy.providerFallback}</option>
                  {selectableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name || provider.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className={footerSelectClassName}>
                <select
                  className={footerSelectInputClassName}
                  value={data.model ?? ""}
                  onChange={(event) => onChange({ model: event.target.value })}
                >
                  <option value="">{propertyPanelCopy.model}</option>
                  {selectableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className={footerSelectClassName}>
                <select
                  className={footerSelectInputClassName}
                  value={data.aspectRatio ?? "1:1"}
                  onChange={(event) => onChange({ aspectRatio: event.target.value })}
                >
                  {aspectRatioOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
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
  "inline-flex h-9 items-center gap-2 rounded-lg bg-control px-3 text-sm font-semibold text-text-primary border border-border-default transition hover:border-border-strong";
const footerSelectInputClassName =
  "min-w-0 max-w-40 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none";

function readNumericDimension(value: unknown, fallback: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}
