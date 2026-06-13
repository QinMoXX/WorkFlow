export type ProviderCapability = "imageGeneration";

export type ProviderModel = {
  id: string;
  name: string;
  capability: ProviderCapability;
};

export type ApiConfig = {
  apiKey: string;
};
