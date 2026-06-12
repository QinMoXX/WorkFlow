import { useEffect, useState } from "react";
import { appCopy, settingsPanelCopy, settingsValidationCopy } from "../data/mockData";
import { NEW_API_BASE_URL } from "../lib/modelCatalog";
import { ApiConfig } from "../types/provider";

export interface ReadonlyAiSettingsPanelProps {
  readonly isOpen: boolean;
  readonly config: ApiConfig;
  readonly onClose: () => void;
  readonly onSave: (config: ApiConfig) => void;
}

export function AiSettingsPanel({ isOpen, config, onClose, onSave }: ReadonlyAiSettingsPanelProps) {
  const [draftConfig, setDraftConfig] = useState<ApiConfig>(config);

  useEffect(() => {
    setDraftConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const validationErrors = validateConfig(draftConfig);

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-app/70 p-7 backdrop-blur" role="presentation">
      <section
        className="grid w-[min(560px,100%)] grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl border border-border-default bg-panel shadow-panel"
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

        <div className="grid gap-4 p-5">
          <label className={fieldClassName}>
            {settingsPanelCopy.providerUrl}
            <input className={inputClassName} value={NEW_API_BASE_URL} readOnly />
          </label>
          <label className={fieldClassName}>
            {settingsPanelCopy.apiKey}
            <input
              className={inputClassName}
              type="password"
              value={draftConfig.apiKey}
              onChange={(event) => setDraftConfig({ apiKey: event.target.value })}
              placeholder={settingsPanelCopy.apiKeyPlaceholder}
            />
          </label>
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
            onClick={() => onSave(draftConfig)}
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
  "w-full rounded-md border border-border-default bg-control px-3 py-2 text-sm font-normal text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 read-only:text-text-muted";
const secondaryButtonClassName =
  "inline-flex h-10 items-center justify-center rounded-lg border border-border-default bg-control px-4 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary";

function validateConfig(config: ApiConfig) {
  if (!config.apiKey.trim()) return [settingsValidationCopy.emptyApiKey];
  return [];
}
