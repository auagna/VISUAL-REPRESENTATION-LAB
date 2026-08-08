import type { ModelCapability, ModelDefinition } from "./types";

const all = (overrides: Partial<Record<ModelCapability, boolean>> = {}) => ({ generation: true, editing: true, maskEditing: true, imageInput: true, multiReference: true, ...overrides });

export const MODEL_REGISTRY: ModelDefinition[] = [
  { id: "mock-image-v1", providerId: "mock", name: "Mock Image v1", description: "결정론적 오프라인 시각화", capabilities: all(), supportedAspectRatios: ["4:3", "3:2", "16:9", "1:1"], supportedQualities: ["draft"], status: "stable", recommendedFor: ["offline", "tests"] },
  { id: "gpt-image-2", providerId: "openai", name: "GPT Image 2", description: "고품질 생성·편집·마스크 워크플로", capabilities: all(), supportedAspectRatios: ["4:3", "3:2", "16:9", "1:1"], supportedQualities: ["low", "medium", "high", "auto"], status: "stable", recommendedFor: ["generation", "region edit", "reference"] },
  { id: "gemini-3.1-flash-lite-image", providerId: "google", name: "Gemini 3.1 Flash Lite Image", description: "속도와 비용 중심 이미지 모델", capabilities: all({ maskEditing: false, multiReference: false }), supportedAspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], supportedQualities: ["1K"], status: "stable", recommendedFor: ["draft", "generation"] },
  { id: "gemini-3.1-flash-image", providerId: "google", name: "Gemini 3.1 Flash Image", description: "범용 생성·편집 및 다중 레퍼런스", capabilities: all({ maskEditing: false }), supportedAspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], supportedQualities: ["1K", "2K", "4K"], status: "stable", recommendedFor: ["generation", "reference", "editing"] },
  { id: "gemini-3-pro-image", providerId: "google", name: "Gemini 3 Pro Image", description: "정밀한 고급 이미지 생성·편집", capabilities: all({ maskEditing: false }), supportedAspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], supportedQualities: ["1K", "2K", "4K"], status: "stable", recommendedFor: ["precision", "reference", "editing"] },
];

export const modelById = (id: string) => MODEL_REGISTRY.find((model) => model.id === id);
export const compatibleModels = (capability: ModelCapability) => MODEL_REGISTRY.filter((model) => model.status !== "deprecated" && model.capabilities[capability]);
