import { ProviderCapability, ProviderModel } from "../types/provider";
import { WorkflowNodeKind } from "../types/workflow";

export const NEW_API_BASE_URL = "https://new-api-production-c695.up.railway.app/v1";

export const modelCatalog: Record<ProviderCapability, ProviderModel[]> = {
  imageGeneration: [
    { id: "agnes-image-2.0-flash", name: "Agnes Image 2.0 Flash", capability: "imageGeneration" },
    { id: "gpt-image-1", name: "GPT Image 1", capability: "imageGeneration" },
    { id: "qwen-image-2.0-pro", name: "Qwen Image 2.0 Pro", capability: "imageGeneration" },
    { id: "qwen-image-2.0", name: "Qwen Image 2.0", capability: "imageGeneration" },
    { id: "qwen-image-max", name: "Qwen Image Max", capability: "imageGeneration" },
  ],
};

const imageGenerationModelIds = [
  "agnes-image-2.0-flash",
  "gpt-image-1",
  "qwen-image-2.0-pro",
  "qwen-image-2.0",
  "qwen-image-max",
];

const imageEditModelIds = [
  "qwen-image-2.0-pro",
  "qwen-image-2.0",
];

export const modelWhitelistByNodeKind: Partial<Record<WorkflowNodeKind, string[]>> = {
  imageGeneration: imageGenerationModelIds,
  textToImage: imageGenerationModelIds,
  imageToImage: imageEditModelIds,
};

export function modelCapabilityForNode(kind: string): ProviderCapability | null {
  if (kind === "imageGeneration" || kind === "textToImage" || kind === "imageToImage") return "imageGeneration";
  return null;
}

export function modelsForNode(kind: WorkflowNodeKind) {
  const capability = modelCapabilityForNode(kind);
  if (!capability) return [];

  const whitelist = modelWhitelistByNodeKind[kind];
  if (!whitelist) return modelCatalog[capability];

  const allowedModelIds = new Set(whitelist);
  return modelCatalog[capability].filter((model) => allowedModelIds.has(model.id));
}

export function firstModelForNode(kind: WorkflowNodeKind) {
  return modelsForNode(kind)[0]?.id ?? "";
}
