export type ProviderCapability = "textToImage" | "imageToImage";

export type ProviderModel = {
  id: string;
  name: string;
  capability: ProviderCapability;
};

export type ApiConfig = {
  apiKey: string;
};
