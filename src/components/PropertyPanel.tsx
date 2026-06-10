import { WorkflowNode, WorkflowNodeData } from "../types/workflow";
import { ProviderConfig } from "../types/provider";
import { providerCapabilityForNode } from "../lib/providerPresets";
import { appCopy, aspectRatioOptions, propertyPanelCopy } from "../data/mockData";

export interface ReadonlyPropertyPanelProps {
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

export function PropertyPanel({
  node,
  providers,
  onChange,
  onImportImage,
  onRun,
  onCancelRun,
  canRun,
  canCancelRun,
  isCancellingRun,
}: ReadonlyPropertyPanelProps) {
  if (!node) {
    return (
      <div className="grid gap-2 rounded-lg border border-dashed border-border-default bg-control p-4">
        <strong className="text-sm text-text-primary">{appCopy.emptySelectionTitle}</strong>
        <span className="text-xs leading-4 text-text-muted">{appCopy.emptySelectionDescription}</span>
      </div>
    );
  }

  const data = node.data;
  const providerCapability = providerCapabilityForNode(data.kind);
  const selectableProviders = providerCapability
    ? providers.filter((provider) =>
        provider.models.some((model) => model.capability === providerCapability),
      )
    : [];
  const selectedProvider = providers.find((provider) => provider.id === data.providerId) ?? null;
  const selectableModels =
    selectedProvider && providerCapability
      ? selectedProvider.models.filter((model) => model.capability === providerCapability)
      : [];

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId);
    const model = provider?.models.find((item) => item.capability === providerCapability);
    onChange({ providerId, model: model?.id ?? "" });
  };

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
            {appCopy.selectedPanelKicker}
          </span>
          <h2 className="mt-1 text-xl font-bold leading-7 text-text-primary">{data.title}</h2>
        </div>
        <button
          className="h-9 rounded-pill bg-inverse px-4 text-sm font-bold text-text-inverse transition hover:bg-text-primary"
          type="button"
          onClick={canCancelRun ? onCancelRun : onRun}
          disabled={data.kind === "group" || (!canRun && !canCancelRun) || isCancellingRun}
        >
          {canCancelRun
            ? isCancellingRun
              ? propertyPanelCopy.cancelling
              : propertyPanelCopy.cancel
            : canRun
              ? propertyPanelCopy.run
              : propertyPanelCopy.running}
        </button>
      </header>

      <label className={fieldClassName}>
        {propertyPanelCopy.name}
        <input className={inputClassName} value={data.title} onChange={(event) => onChange({ title: event.target.value })} />
      </label>

      {data.kind === "textInput" && (
        <label className={fieldClassName}>
          {propertyPanelCopy.textContent}
          <textarea
            className={inputClassName}
            value={data.content ?? ""}
            onChange={(event) => onChange({ content: event.target.value })}
            rows={8}
          />
        </label>
      )}

      {data.kind === "imageInput" && (
        <>
          <label className={fieldClassName}>
            {propertyPanelCopy.chooseImage}
            <input
              className={inputClassName}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImportImage(file);
                event.target.value = "";
              }}
            />
          </label>
          <label className={fieldClassName}>
            {propertyPanelCopy.imagePath}
            <input
              className={inputClassName}
              value={data.imagePath ?? ""}
              onChange={(event) =>
                onChange({
                  imagePath: event.target.value,
                  thumbnailPath: undefined,
                  resultPath: event.target.value,
                })
              }
              placeholder={propertyPanelCopy.imagePathPlaceholder}
            />
          </label>
        </>
      )}

      {(data.kind === "textToImage" || data.kind === "imageToImage") && (
        <>
          <label className={fieldClassName}>
            {propertyPanelCopy.provider}
            <select
              className={inputClassName}
              value={data.providerId ?? ""}
              onChange={(event) => handleProviderChange(event.target.value)}
            >
              <option value="">{propertyPanelCopy.providerPlaceholder}</option>
              {selectableProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name || provider.id}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClassName}>
            {propertyPanelCopy.model}
            <select className={inputClassName} value={data.model ?? ""} onChange={(event) => onChange({ model: event.target.value })}>
              <option value="">{propertyPanelCopy.modelPlaceholder}</option>
              {selectableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClassName}>
            {propertyPanelCopy.promptOverride}
            <textarea
              className={inputClassName}
              value={data.promptOverride ?? ""}
              onChange={(event) => onChange({ promptOverride: event.target.value })}
              rows={5}
            />
          </label>
          <label className={fieldClassName}>
            {propertyPanelCopy.aspectRatio}
            <select
              className={inputClassName}
              value={data.aspectRatio ?? "1:1"}
              onChange={(event) => onChange({ aspectRatio: event.target.value })}
            >
              {aspectRatioOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClassName}>
            {propertyPanelCopy.style}
            <input
              className={inputClassName}
              value={data.stylePreset ?? ""}
              onChange={(event) => onChange({ stylePreset: event.target.value })}
            />
          </label>
          <label className={fieldClassName}>
            {propertyPanelCopy.seed}
            <input className={inputClassName} value={data.seed ?? ""} onChange={(event) => onChange({ seed: event.target.value })} />
          </label>
        </>
      )}

      {data.kind === "textToImage" && (
        <label className={fieldClassName}>
          {propertyPanelCopy.negativePrompt}
          <textarea
            className={inputClassName}
            value={data.negativePrompt ?? ""}
            onChange={(event) => onChange({ negativePrompt: event.target.value })}
            rows={4}
          />
        </label>
      )}

      {data.kind === "imageToImage" && (
        <label className={fieldClassName}>
          {propertyPanelCopy.strength}
          <input
            className="accent-accent"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={data.strength ?? 0.65}
            onChange={(event) => onChange({ strength: Number(event.target.value) })}
          />
          <span className="text-xs text-text-muted">{data.strength ?? 0.65}</span>
        </label>
      )}

      {data.kind === "output" && (
        <label className={fieldClassName}>
          {propertyPanelCopy.saveDirectory}
          <input
            className={inputClassName}
            value={data.saveDirectory ?? ""}
            onChange={(event) => onChange({ saveDirectory: event.target.value })}
          />
        </label>
      )}

      {data.kind === "group" && (
        <div className="grid gap-2 rounded-lg border border-dashed border-border-default bg-control p-4">
          <strong className="text-sm text-text-primary">{appCopy.groupTitle}</strong>
          <span className="text-xs leading-4 text-text-muted">{appCopy.groupDescription}</span>
        </div>
      )}
    </div>
  );
}

const fieldClassName = "grid gap-2 text-sm font-semibold text-text-secondary";
const inputClassName =
  "w-full rounded-md border border-border-default bg-control px-3 py-2 text-sm font-normal text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";
