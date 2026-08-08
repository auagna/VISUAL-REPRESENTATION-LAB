/* VRL provider/model execution runtime — contains no credentials. */
(() => {
  "use strict";

  const capabilities = (overrides = {}) => ({ generation: true, editing: true, maskEditing: true, imageInput: true, multiReference: true, ...overrides });
  const models = [
    { id: "mock-image-v1", providerId: "mock", name: "Mock Image v1", description: "결정론적 오프라인 시각화", capabilities: capabilities(), aspectRatios: ["4:3", "3:2", "16:9", "1:1"], qualities: ["draft"], status: "stable" },
    { id: "gpt-image-2", providerId: "openai", name: "GPT Image 2", description: "고품질 생성·편집·마스크 워크플로", capabilities: capabilities(), aspectRatios: ["4:3", "3:2", "16:9", "1:1"], qualities: ["low", "medium", "high", "auto"], status: "stable" },
    { id: "gemini-3.1-flash-lite-image", providerId: "google", name: "Gemini 3.1 Flash Lite Image", description: "속도와 비용 중심 이미지 모델", capabilities: capabilities({ maskEditing: false, multiReference: false }), aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], qualities: ["1K"], status: "stable" },
    { id: "gemini-3.1-flash-image", providerId: "google", name: "Gemini 3.1 Flash Image", description: "범용 생성·편집 및 다중 레퍼런스", capabilities: capabilities({ maskEditing: false }), aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], qualities: ["1K", "2K", "4K"], status: "stable" },
    { id: "gemini-3-pro-image", providerId: "google", name: "Gemini 3 Pro Image", description: "정밀한 고급 이미지 생성·편집", capabilities: capabilities({ maskEditing: false }), aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], qualities: ["1K", "2K", "4K"], status: "stable" },
  ];
  const providers = [
    { id: "openai", name: "OPENAI", mode: "real" },
    { id: "google", name: "GOOGLE GEMINI", mode: "real" },
    { id: "mock", name: "MOCK", mode: "offline" },
  ];
  const modelById = Object.fromEntries(models.map((model) => [model.id, model]));

  class RouterError extends Error {
    constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
  }

  function compatibleModels(capability) { return models.filter((model) => model.status !== "deprecated" && model.capabilities[capability]); }
  function defaultSettings() {
    return { generationModel: null, editModel: null, referenceModel: null, mockExplicit: false };
  }
  function defaultProjectExecution() {
    return { useGlobalDefaults: true, generationModel: null, editModel: null, referenceModel: null, generatorOverrides: {}, aspectRatio: "4:3", quality: "high", count: 1 };
  }
  function selectionFor(capability, globalSettings, projectExecution, nodeId) {
    const override = nodeId && projectExecution?.generatorOverrides?.[nodeId];
    if (override) return override;
    const key = capability === "maskEditing" || capability === "editing" ? "editModel" : capability === "imageInput" ? "referenceModel" : "generationModel";
    if (projectExecution && !projectExecution.useGlobalDefaults && projectExecution[key]) return projectExecution[key];
    return globalSettings?.[key] || (key === "referenceModel" ? globalSettings?.generationModel : null);
  }

  class ModelRouter {
    resolve({ capability, globalSettings, projectExecution, nodeId, statuses = {} }) {
      const selection = selectionFor(capability, globalSettings, projectExecution, nodeId);
      if (!selection) throw new RouterError("CONNECTION_REQUIRED", "AI 모델 연결 또는 Mock 모드 선택이 필요합니다.");
      const model = modelById[selection.modelId];
      if (!model || model.providerId !== selection.providerId) throw new RouterError("MODEL_UNAVAILABLE", "선택한 모델이 레지스트리에 없습니다.");
      if (!model.capabilities[capability]) throw new RouterError("UNSUPPORTED_CAPABILITY", "MODEL DOES NOT SUPPORT THIS OPERATION", { recommendations: compatibleModels(capability) });
      if (selection.providerId === "mock" && !globalSettings?.mockExplicit) throw new RouterError("CONNECTION_REQUIRED", "Mock 모드를 명시적으로 선택해야 합니다.");
      if (selection.providerId !== "mock" && statuses[selection.providerId] !== "connected") throw new RouterError("CONNECTION_REQUIRED", `${selection.providerId} provider is not connected.`);
      return { provider: providers.find((item) => item.id === selection.providerId), model, selection };
    }

    async execute(input) {
      const resolved = this.resolve(input);
      if (resolved.provider.id === "mock") return { ...resolved, mock: true };
      const response = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: input.operation, providerId: resolved.provider.id, modelId: resolved.model.id, request: input.request }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new RouterError(payload.error?.code || "UNKNOWN", payload.error?.message || "Provider request failed.", payload.error?.details);
      return { ...resolved, mock: false, images: payload.images };
    }
  }

  globalThis.VRL_AI = { models, providers, modelById, compatibleModels, defaultSettings, defaultProjectExecution, selectionFor, ModelRouter, RouterError };
})();
