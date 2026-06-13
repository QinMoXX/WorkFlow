import { ProviderCapability, ProviderModel } from "../types/provider";
import { WorkflowNodeKind } from "../types/workflow";

export const NEW_API_BASE_URL = "https://new-api-production-c695.up.railway.app/v1";

export const modelCatalog: Record<ProviderCapability, ProviderModel[]> = {
  imageGeneration: [
    { id: "agnes-image-2.0-flash", name: "Agnes Image 2.0 Flash", capability: "imageGeneration" },
    { id: "gpt-image-1", name: "GPT Image 1", capability: "imageGeneration" },
  ],
};

export const modelWhitelistByNodeKind: Partial<Record<WorkflowNodeKind, string[]>> = {
  imageGeneration: ["agnes-image-2.0-flash", "gpt-image-1"],
  textToImage: ["agnes-image-2.0-flash", "gpt-image-1"],
  imageToImage: ["agnes-image-2.0-flash", "gpt-image-1"],
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
