import { useEffect, useState } from "react";
import { ProviderCapability, ProviderConfig, ProviderModel } from "../types/provider";
import { appCopy, capabilityLabels, settingsPanelCopy, settingsValidationCopy } from "../data/mockData";

export interface ReadonlyAiSettingsPanelProps {
  readonly isOpen: boolean;
  readonly providers: ProviderConfig[];
  readonly onClose: () => void;
  readonly onSave: (providers: ProviderConfig[]) => void;
}

function createProvider(): ProviderConfig {
  const id = `provider-${Date.now()}`;
  return {
    id,
    name: settingsPanelCopy.newProviderName,
    baseUrl: "",
    apiKey: "",
    proxyUrl: "",
    models: [],
  };
}

function createModel(): ProviderModel {
  return {
    id: "",
    name: "",
    capability: "textToImage",
  };
}

export function AiSettingsPanel({ isOpen, providers, onClose, onSave }: ReadonlyAiSettingsPanelProps) {
  const [draftProviders, setDraftProviders] = useState<ProviderConfig[]>(providers);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(providers[0]?.id ?? null);

  useEffect(() => {
    setDraftProviders(providers);
    setSelectedProviderId((current) => {
      if (current && providers.some((provider) => provider.id === current)) return current;
      return providers[0]?.id ?? null;
    });
  }, [providers]);

  if (!isOpen) return null;

  const selectedProvider = draftProviders.find((provider) => provider.id === selectedProviderId) ?? null;
  const validationErrors = validateProviders(draftProviders);

  const updateProvider = (providerId: string, patch: Partial<ProviderConfig>) => {
    setDraftProviders((current) =>
      current.map((provider) => (provider.id === providerId ? { ...provider, ...patch } : provider)),
    );
  };

  const updateProviderId = (providerId: string, nextProviderId: string) => {
    updateProvider(providerId, { id: nextProviderId });
    setSelectedProviderId(nextProviderId);
  };

  const updateModel = (providerId: string, index: number, patch: Partial<ProviderModel>) => {
    setDraftProviders((current) =>
      current.map((provider) => {
        if (provider.id !== providerId) return provider;
        return {
          ...provider,
          models: provider.models.map((model, modelIndex) =>
            modelIndex === index ? { ...model, ...patch } : model,
          ),
        };
      }),
    );
  };

  const addProvider = () => {
    const provider = createProvider();
    setDraftProviders((current) => [...current, provider]);
    setSelectedProviderId(provider.id);
  };

  const removeProvider = (providerId: string) => {
    setDraftProviders((current) => current.filter((provider) => provider.id !== providerId));
    setSelectedProviderId((current) => (current === providerId ? null : current));
  };

  const addModel = (providerId: string) => {
    setDraftProviders((current) =>
      current.map((provider) =>
        provider.id === providerId ? { ...provider, models: [...provider.models, createModel()] } : provider,
      ),
    );
  };

  const removeModel = (providerId: string, index: number) => {
    setDraftProviders((current) =>
      current.map((provider) => {
        if (provider.id !== providerId) return provider;
        return {
          ...provider,
          models: provider.models.filter((_, modelIndex) => modelIndex !== index),
        };
      }),
    );
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-app/70 p-7 backdrop-blur" role="presentation">
      <section
        className="grid max-h-[min(760px,calc(100vh-56px))] w-[min(980px,100%)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border-default bg-panel shadow-panel"
        role="dialog"
        aria-modal="true"
        aria-label={appCopy.settingsTitle}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
              {appCopy.settingsKicker}
            </span>
            <h2 className="mt-1 text-xl font-bold leading-7 text-text-primary">{appCopy.settingsTitle}</h2>
          </div>
          <button className={secondaryButtonClassName} type="button" onClick={onClose}>
            {settingsPanelCopy.close}
          </button>
        </header>

        <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)] max-[820px]:grid-cols-1">
          <aside className="flex min-h-0 flex-col gap-2 overflow-auto border-r border-border-subtle bg-canvas p-4 max-[820px]:max-h-44 max-[820px]:border-b max-[820px]:border-r-0">
            {draftProviders.map((provider) => (
              <button
                key={provider.id}
                className={[
                  "grid gap-1 rounded-lg border p-3 text-left transition",
                  provider.id === selectedProviderId
                    ? "border-border-default bg-panel-raised"
                    : "border-transparent bg-transparent hover:bg-control",
                ].join(" ")}
                type="button"
                onClick={() => setSelectedProviderId(provider.id)}
              >
                <strong className="text-sm text-text-primary">{provider.name || provider.id}</strong>
                <span className="text-xs text-text-muted">
                  {provider.models.length} {settingsPanelCopy.modelCountSuffix}
                </span>
              </button>
            ))}
            <button className={secondaryButtonClassName} type="button" onClick={addProvider}>
              {settingsPanelCopy.addProvider}
            </button>
          </aside>

          {selectedProvider ? (
            <div className="grid min-h-0 gap-4 overflow-auto p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-text-primary">
                  {selectedProvider.name || settingsPanelCopy.unnamedProvider}
                </h3>
                <button
                  className={dangerButtonClassName}
                  type="button"
                  onClick={() => removeProvider(selectedProvider.id)}
                >
                  {settingsPanelCopy.delete}
                </button>
              </div>

              <label className={fieldClassName}>
                {settingsPanelCopy.providerId}
                <input
                  className={inputClassName}
                  value={selectedProvider.id}
                  onChange={(event) => updateProviderId(selectedProvider.id, event.target.value.trim())}
                />
              </label>
              <label className={fieldClassName}>
                {settingsPanelCopy.name}
                <input
                  className={inputClassName}
                  value={selectedProvider.name}
                  onChange={(event) => updateProvider(selectedProvider.id, { name: event.target.value })}
                />
              </label>
              <label className={fieldClassName}>
                {settingsPanelCopy.providerUrl}
                <input
                  className={inputClassName}
                  value={selectedProvider.baseUrl}
                  onChange={(event) => updateProvider(selectedProvider.id, { baseUrl: event.target.value })}
                  placeholder={settingsPanelCopy.providerUrlPlaceholder}
                />
              </label>
              <label className={fieldClassName}>
                {settingsPanelCopy.apiKey}
                <input
                  className={inputClassName}
                  type="password"
                  value={selectedProvider.apiKey}
                  onChange={(event) => updateProvider(selectedProvider.id, { apiKey: event.target.value })}
                  placeholder={settingsPanelCopy.apiKeyPlaceholder}
                />
              </label>
              <label className={fieldClassName}>
                {settingsPanelCopy.proxyUrl}
                <input
                  className={inputClassName}
                  value={selectedProvider.proxyUrl ?? ""}
                  onChange={(event) => updateProvider(selectedProvider.id, { proxyUrl: event.target.value })}
                  placeholder={settingsPanelCopy.proxyUrlPlaceholder}
                />
              </label>

              <div className="grid gap-3 border-t border-border-subtle pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-text-primary">{settingsPanelCopy.modelList}</h3>
                  <button
                    className={secondaryButtonClassName}
                    type="button"
                    onClick={() => addModel(selectedProvider.id)}
                  >
                    {settingsPanelCopy.addModel}
                  </button>
                </div>

                {selectedProvider.models.map((model, index) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_auto] items-end gap-3 rounded-lg border border-border-subtle bg-control p-3 max-[820px]:grid-cols-1"
                    key={`${selectedProvider.id}-${index}`}
                  >
                    <label className={fieldClassName}>
                      {settingsPanelCopy.modelId}
                      <input
                        className={inputClassName}
                        value={model.id}
                        onChange={(event) => updateModel(selectedProvider.id, index, { id: event.target.value })}
                      />
                    </label>
                    <label className={fieldClassName}>
                      {settingsPanelCopy.displayName}
                      <input
                        className={inputClassName}
                        value={model.name}
                        onChange={(event) => updateModel(selectedProvider.id, index, { name: event.target.value })}
                      />
                    </label>
                    <label className={fieldClassName}>
                      {settingsPanelCopy.capability}
                      <select
                        className={inputClassName}
                        value={model.capability}
                        onChange={(event) =>
                          updateModel(selectedProvider.id, index, {
                            capability: event.target.value as ProviderCapability,
                          })
                        }
                      >
                        {Object.entries(capabilityLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className={dangerButtonClassName}
                      type="button"
                      onClick={() => removeModel(selectedProvider.id, index)}
                    >
                      {settingsPanelCopy.delete}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="m-5 grid content-start gap-2 rounded-lg border border-dashed border-border-default bg-control p-4">
              <strong className="text-sm text-text-primary">{appCopy.emptyProviderTitle}</strong>
              <span className="text-xs leading-4 text-text-muted">{appCopy.emptyProviderDescription}</span>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-border-subtle px-5 py-4">
          {validationErrors.length > 0 && (
            <div className="mr-auto flex min-w-0 flex-1 flex-wrap gap-2">
              {validationErrors.map((error) => (
                <span className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger" key={error}>
                  {error}
                </span>
              ))}
            </div>
          )}
          <button className={secondaryButtonClassName} type="button" onClick={onClose}>
            {settingsPanelCopy.cancel}
          </button>
          <button
            className="h-10 rounded-pill bg-inverse px-5 text-sm font-bold text-text-inverse transition hover:bg-text-primary"
            type="button"
            disabled={validationErrors.length > 0}
            onClick={() => onSave(draftProviders)}
          >
            {settingsPanelCopy.save}
          </button>
        </footer>
      </section>
    </div>
  );
}

const fieldClassName = "grid gap-2 text-sm font-semibold text-text-secondary";
const inputClassName =
  "w-full rounded-md border border-border-default bg-control px-3 py-2 text-sm font-normal text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";
const secondaryButtonClassName =
  "inline-flex h-10 items-center justify-center rounded-lg border border-border-default bg-control px-4 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary";
const dangerButtonClassName =
  "inline-flex h-10 items-center justify-center rounded-lg border border-danger/40 bg-danger/10 px-4 text-sm font-bold text-danger transition hover:bg-danger/15";

function validateProviders(providers: ProviderConfig[]) {
  const errors: string[] = [];
  const providerIds = new Set<string>();

  for (const provider of providers) {
    const providerId = provider.id.trim();
    if (!providerId) {
      errors.push(settingsValidationCopy.emptyProviderId);
    } else if (providerIds.has(providerId)) {
      errors.push(`${settingsValidationCopy.duplicateProviderId}${providerId}`);
    }
    providerIds.add(providerId);

    if (!provider.name.trim()) {
      errors.push(
        `${settingsPanelCopy.provider} ${providerId || settingsValidationCopy.unnamedProviderFallback} ${settingsValidationCopy.emptyProviderName}`,
      );
    }

    const modelKeys = new Set<string>();
    for (const model of provider.models) {
      const modelId = model.id.trim();
      if (!modelId) {
        errors.push(
          `${settingsPanelCopy.provider} ${provider.name || providerId} ${settingsValidationCopy.emptyModelId}`,
        );
        continue;
      }
      const modelKey = `${modelId}:${model.capability}`;
      if (modelKeys.has(modelKey)) {
        errors.push(
          `${settingsPanelCopy.provider} ${provider.name || providerId} ${settingsValidationCopy.duplicateModel}${modelId}`,
        );
      }
      modelKeys.add(modelKey);
    }
  }

  return Array.from(new Set(errors));
}
