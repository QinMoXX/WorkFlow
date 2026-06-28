import { invoke } from "@tauri-apps/api/core";
import {
  ModelCatalogConfig,
  ProviderCapability,
  ProviderModel,
} from "../types/provider";
import { WorkflowNodeKind } from "../types/workflow";

const fallbackModelCatalogConfig: ModelCatalogConfig = {
  baseUrl: "https://new-api-production-c695.up.railway.app/v1",
  models: [
    {
      id: "agnes-image-2.0-flash",
      name: "Agnes Image 2.0 Flash",
      capability: "imageGeneration",
    },
    { id: "gpt-image-1", name: "GPT Image 1", capability: "imageGeneration" },
    {
      id: "qwen-image-2.0-pro",
      name: "Qwen Image 2.0 Pro",
      capability: "imageGeneration",
    },
    {
      id: "qwen-image-2.0",
      name: "Qwen Image 2.0",
      capability: "imageGeneration",
    },
    {
      id: "qwen-image-max",
      name: "Qwen Image Max",
      capability: "imageGeneration",
    },
  ],
  modelWhitelistByNodeKind: [
    {
      nodeKind: "imageGeneration",
      modelIds: [
        "agnes-image-2.0-flash",
        "gpt-image-1",
        "qwen-image-2.0-pro",
        "qwen-image-2.0",
        "qwen-image-max",
      ],
    },
    {
      nodeKind: "textToImage",
      modelIds: [
        "agnes-image-2.0-flash",
        "gpt-image-1",
        "qwen-image-2.0-pro",
        "qwen-image-2.0",
        "qwen-image-max",
      ],
    },
    {
      nodeKind: "imageToImage",
      modelIds: ["qwen-image-2.0-pro", "qwen-image-2.0"],
    },
  ],
};

let modelCatalogConfig = fallbackModelCatalogConfig;

export let NEW_API_BASE_URL = modelCatalogConfig.baseUrl;
export let modelCatalog = buildModelCatalog(modelCatalogConfig.models);
export let modelWhitelistByNodeKind = buildModelWhitelist(
  modelCatalogConfig.modelWhitelistByNodeKind,
);

export async function loadBackendModelCatalog() {
  const config = await invoke<ModelCatalogConfig>("load_model_catalog");
  configureModelCatalog(config);
  return config;
}

export function configureModelCatalog(config: ModelCatalogConfig) {
  modelCatalogConfig = config;
  NEW_API_BASE_URL = config.baseUrl;
  modelCatalog = buildModelCatalog(config.models);
  modelWhitelistByNodeKind = buildModelWhitelist(
    config.modelWhitelistByNodeKind,
  );
}

export function modelCapabilityForNode(
  kind: string,
): ProviderCapability | null {
  if (
    kind === "imageGeneration" ||
    kind === "textToImage" ||
    kind === "imageToImage"
  )
    return "imageGeneration";
  return null;
}

export function modelsForNode(kind: WorkflowNodeKind) {
  const capability = modelCapabilityForNode(kind);
  if (!capability) return [];

  const models = modelCatalog[capability] ?? [];
  const whitelist = modelWhitelistByNodeKind[kind];
  if (!whitelist) return models;

  const allowedModelIds = new Set(whitelist);
  return models.filter((model) => allowedModelIds.has(model.id));
}

export function firstModelForNode(kind: WorkflowNodeKind) {
  return modelsForNode(kind)[0]?.id ?? "";
}

function buildModelCatalog(models: ProviderModel[]) {
  return models.reduce(
    (catalog, model) => {
      catalog[model.capability] = [...(catalog[model.capability] ?? []), model];
      return catalog;
    },
    { imageGeneration: [] } as Record<ProviderCapability, ProviderModel[]>,
  );
}

function buildModelWhitelist(
  entries: ModelCatalogConfig["modelWhitelistByNodeKind"],
) {
  return entries.reduce(
    (catalog, entry) => {
      catalog[entry.nodeKind] = entry.modelIds;
      return catalog;
    },
    {} as Partial<Record<WorkflowNodeKind, string[]>>,
  );
}
