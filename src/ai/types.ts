import type { RepresentationState } from "@/representation/schema";

export type ModelCapability = "generation" | "editing" | "maskEditing" | "imageInput" | "multiReference";
export type ConnectionStatus = "connected" | "not_connected" | "invalid_key" | "rate_limited" | "unavailable";
export type ProviderErrorCode = "AUTH_ERROR" | "RATE_LIMIT" | "MODEL_UNAVAILABLE" | "INVALID_REQUEST" | "UNSUPPORTED_CAPABILITY" | "SAFETY_REJECTION" | "NETWORK_ERROR" | "CONNECTION_REQUIRED" | "UNKNOWN";

export type ImageAsset = { dataUrl?: string; url?: string; mimeType: string; name?: string };
export type GeneratedImage = {
  id: string;
  url?: string;
  dataUrl?: string;
  mimeType: string;
  providerId: string;
  modelId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type ModelDefinition = {
  id: string;
  providerId: string;
  name: string;
  description?: string;
  capabilities: Record<ModelCapability, boolean>;
  supportedAspectRatios?: string[];
  supportedQualities?: string[];
  status: "stable" | "preview" | "deprecated";
  recommendedFor?: string[];
};

export type ConnectionTestResult = { status: ConnectionStatus; message: string };
export type ImageGenerationRequest = {
  representationState: RepresentationState;
  compiledInstruction: string;
  sourceImages?: ImageAsset[];
  references?: ImageAsset[];
  aspectRatio?: string;
  quality?: string;
  count?: number;
  metadata?: { projectId?: string; nodeId?: string; experimentId?: string };
};
export type ImageEditRequest = {
  sourceImage: ImageAsset;
  mask?: ImageAsset;
  references?: ImageAsset[];
  representationState: RepresentationState;
  regionState?: unknown;
  compiledInstruction: string;
  aspectRatio?: string;
  quality?: string;
};

export interface AIImageProvider {
  readonly id: string;
  readonly name: string;
  testConnection(): Promise<ConnectionTestResult>;
  listModels(): Promise<ModelDefinition[]>;
  generate(request: ImageGenerationRequest, model: ModelDefinition): Promise<GeneratedImage[]>;
  edit?(request: ImageEditRequest, model: ModelDefinition): Promise<GeneratedImage[]>;
}

export type ExecutionSelection = { providerId: string; modelId: string };
export type ExecutionState = {
  useGlobalDefaults: boolean;
  generationModel?: ExecutionSelection;
  editModel?: ExecutionSelection;
  referenceModel?: ExecutionSelection;
  generatorOverrides: Record<string, ExecutionSelection>;
  aspectRatio: string;
  quality: string;
  count: number;
};

export class ProviderError extends Error {
  constructor(public code: ProviderErrorCode, message: string, public details?: unknown) { super(message); }
}
