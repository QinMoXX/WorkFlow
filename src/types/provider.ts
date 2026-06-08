export type ProviderCapability = "textToImage" | "imageToImage";

export type ProviderModel = {
  id: string;
  name: string;
  capability: ProviderCapability;
};

export type ProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string;
  models: ProviderModel[];
};
