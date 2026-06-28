import type { WorkflowNodeKind } from "./workflow";

export type ProviderCapability = "imageGeneration";

export type ProviderModel = {
  id: string;
  name: string;
  capability: ProviderCapability;
};

export type ModelCatalogConfig = {
  baseUrl: string;
  models: ProviderModel[];
  modelWhitelistByNodeKind: Array<{
    nodeKind: WorkflowNodeKind;
    modelIds: string[];
  }>;
};

export type ApiConfig = {
  apiKey: string;
};
