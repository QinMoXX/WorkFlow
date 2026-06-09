import { useEffect, useState } from "react";
import { ProviderCapability, ProviderConfig, ProviderModel } from "../types/provider";

type AiSettingsPanelProps = {
  isOpen: boolean;
  providers: ProviderConfig[];
  onClose: () => void;
  onSave: (providers: ProviderConfig[]) => void;
};

const capabilityLabels: Record<ProviderCapability, string> = {
  textToImage: "文生图",
  imageToImage: "图生图",
};

function createProvider(): ProviderConfig {
  const id = `provider-${Date.now()}`;
  return {
    id,
    name: "新供应商",
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

export function AiSettingsPanel({ isOpen, providers, onClose, onSave }: AiSettingsPanelProps) {
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
    <div className="settings-backdrop" role="presentation">
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label="AI 配置">
        <header className="settings-header">
          <div>
            <span className="panel-kicker">设置</span>
            <h2>AI 配置</h2>
          </div>
          <button className="secondary-action compact-action" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="settings-body">
          <aside className="provider-list">
            {draftProviders.map((provider) => (
              <button
                key={provider.id}
                className={provider.id === selectedProviderId ? "provider-tab is-active" : "provider-tab"}
                type="button"
                onClick={() => setSelectedProviderId(provider.id)}
              >
                <strong>{provider.name || provider.id}</strong>
                <span>{provider.models.length} 个模型</span>
              </button>
            ))}
            <button className="secondary-action" type="button" onClick={addProvider}>
              新增供应商
            </button>
          </aside>

          {selectedProvider ? (
            <div className="provider-form">
              <div className="provider-form-header">
                <h3>{selectedProvider.name || "未命名供应商"}</h3>
                <button
                  className="danger-action"
                  type="button"
                  onClick={() => removeProvider(selectedProvider.id)}
                >
                  删除
                </button>
              </div>

              <label>
                供应商 ID
                <input
                  value={selectedProvider.id}
                  onChange={(event) => updateProviderId(selectedProvider.id, event.target.value.trim())}
                />
              </label>
              <label>
                名称
                <input
                  value={selectedProvider.name}
                  onChange={(event) => updateProvider(selectedProvider.id, { name: event.target.value })}
                />
              </label>
              <label>
                供应商 URL
                <input
                  value={selectedProvider.baseUrl}
                  onChange={(event) => updateProvider(selectedProvider.id, { baseUrl: event.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </label>
              <label>
                API Key
                <input
                  type="password"
                  value={selectedProvider.apiKey}
                  onChange={(event) => updateProvider(selectedProvider.id, { apiKey: event.target.value })}
                  placeholder="sk-..."
                />
              </label>
              <label>
                代理地址
                <input
                  value={selectedProvider.proxyUrl ?? ""}
                  onChange={(event) => updateProvider(selectedProvider.id, { proxyUrl: event.target.value })}
                  placeholder="http://127.0.0.1:7890"
                />
              </label>

              <div className="model-section">
                <div className="model-section-header">
                  <h3>模型列表</h3>
                  <button
                    className="secondary-action compact-action"
                    type="button"
                    onClick={() => addModel(selectedProvider.id)}
                  >
                    新增模型
                  </button>
                </div>

                {selectedProvider.models.map((model, index) => (
                  <div className="model-row" key={`${selectedProvider.id}-${index}`}>
                    <label>
                      模型 ID
                      <input
                        value={model.id}
                        onChange={(event) => updateModel(selectedProvider.id, index, { id: event.target.value })}
                      />
                    </label>
                    <label>
                      显示名称
                      <input
                        value={model.name}
                        onChange={(event) => updateModel(selectedProvider.id, index, { name: event.target.value })}
                      />
                    </label>
                    <label>
                      能力
                      <select
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
                      className="danger-action model-delete"
                      type="button"
                      onClick={() => removeModel(selectedProvider.id, index)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-panel">
              <strong>暂无供应商</strong>
              <span>新增供应商后配置 URL、API Key 和模型列表。</span>
            </div>
          )}
        </div>

        <footer className="settings-footer">
          {validationErrors.length > 0 && (
            <div className="settings-errors">
              {validationErrors.map((error) => (
                <span key={error}>{error}</span>
              ))}
            </div>
          )}
          <button className="secondary-action compact-action" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-action compact-action"
            type="button"
            disabled={validationErrors.length > 0}
            onClick={() => onSave(draftProviders)}
          >
            保存配置
          </button>
        </footer>
      </section>
    </div>
  );
}

function validateProviders(providers: ProviderConfig[]) {
  const errors: string[] = [];
  const providerIds = new Set<string>();

  for (const provider of providers) {
    const providerId = provider.id.trim();
    if (!providerId) {
      errors.push("供应商 ID 不能为空");
    } else if (providerIds.has(providerId)) {
      errors.push(`供应商 ID 重复：${providerId}`);
    }
    providerIds.add(providerId);

    if (!provider.name.trim()) {
      errors.push(`供应商 ${providerId || "(未命名)"} 名称不能为空`);
    }

    const modelKeys = new Set<string>();
    for (const model of provider.models) {
      const modelId = model.id.trim();
      if (!modelId) {
        errors.push(`供应商 ${provider.name || providerId} 存在空模型 ID`);
        continue;
      }
      const modelKey = `${modelId}:${model.capability}`;
      if (modelKeys.has(modelKey)) {
        errors.push(`供应商 ${provider.name || providerId} 模型重复：${modelId}`);
      }
      modelKeys.add(modelKey);
    }
  }

  return Array.from(new Set(errors));
}
