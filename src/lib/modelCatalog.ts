import { ProviderCapability, ProviderModel } from "../types/provider";
import { WorkflowNodeKind } from "../types/workflow";

export const NEW_API_BASE_URL = "https://new-api-production-c695.up.railway.app/v1";

export const modelCatalog: Record<ProviderCapability, ProviderModel[]> = {
  textToImage: [
    { id: "agnes-2.0-flash", name: "Agnes 2.0 Flash", capability: "textToImage" },
    { id: "agnes-image-2.0-flash", name: "Agnes Image 2.0 Flash", capability: "textToImage" },
    { id: "gpt-image-1", name: "GPT Image 1", capability: "textToImage" },
  ],
  imageToImage: [
    { id: "agnes-2.0-flash", name: "Agnes 2.0 Flash Edit", capability: "imageToImage" },
    { id: "agnes-image-2.0-flash", name: "Agnes Image 2.0 Flash Edit", capability: "imageToImage" },
    { id: "gpt-image-1", name: "GPT Image 1 Edit", capability: "imageToImage" },
  ],
};

export const modelWhitelistByNodeKind: Partial<Record<WorkflowNodeKind, string[]>> = {
  textToImage: ["agnes-2.0-flash", "agnes-image-2.0-flash", "gpt-image-1"],
  imageToImage: ["agnes-2.0-flash", "agnes-image-2.0-flash", "gpt-image-1"],
};

export function modelCapabilityForNode(kind: string): ProviderCapability | null {
  if (kind === "textToImage") return "textToImage";
  if (kind === "imageToImage") return "imageToImage";
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
