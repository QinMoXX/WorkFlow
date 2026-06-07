import { ProviderCapability, ProviderConfig } from "../types/provider";

export const defaultProviderConfigs: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    models: [
      { id: "gpt-image-1", name: "GPT Image 1", capability: "textToImage" },
      { id: "gpt-image-1", name: "GPT Image 1 Edit", capability: "imageToImage" },
    ],
  },
];

export function providerCapabilityForNode(kind: string): ProviderCapability | null {
  if (kind === "textToImage") return "textToImage";
  if (kind === "imageToImage") return "imageToImage";
  return null;
}

export function firstProviderPreset(
  providers: ProviderConfig[],
  capability: ProviderCapability,
): { providerId: string; model: string } | null {
  for (const provider of providers) {
    const model = provider.models.find((item) => item.capability === capability);
    if (model) {
      return { providerId: provider.id, model: model.id };
    }
  }
  return null;
}
