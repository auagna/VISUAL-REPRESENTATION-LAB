import { compatibleModels, modelById } from "./modelRegistry";
import { ProviderError, type AIImageProvider, type ExecutionSelection, type ImageEditRequest, type ImageGenerationRequest, type ModelCapability } from "./types";

export class ModelRouter {
  constructor(private providers: Map<string, AIImageProvider>) {}

  resolve(capability: ModelCapability, selections: Array<ExecutionSelection | undefined>) {
    const selection = selections.find(Boolean);
    if (!selection) throw new ProviderError("CONNECTION_REQUIRED", "AI 모델 연결 또는 Mock 모드 선택이 필요합니다.");
    const model = modelById(selection.modelId);
    if (!model || model.providerId !== selection.providerId) throw new ProviderError("MODEL_UNAVAILABLE", "선택한 모델이 레지스트리에 없습니다.");
    if (!model.capabilities[capability]) {
      const recommendations = compatibleModels(capability).map((item) => `${item.providerId}/${item.id}`);
      throw new ProviderError("UNSUPPORTED_CAPABILITY", "MODEL DOES NOT SUPPORT THIS OPERATION", { recommendations });
    }
    const provider = this.providers.get(model.providerId);
    if (!provider) throw new ProviderError("CONNECTION_REQUIRED", `${model.providerId} provider is not connected.`);
    return { provider, model };
  }

  async generate(request: ImageGenerationRequest, selections: Array<ExecutionSelection | undefined>) {
    const { provider, model } = this.resolve(request.references?.length ? "imageInput" : "generation", selections);
    return provider.generate(request, model);
  }

  async edit(request: ImageEditRequest, selections: Array<ExecutionSelection | undefined>) {
    const capability: ModelCapability = request.mask ? "maskEditing" : "editing";
    const { provider, model } = this.resolve(capability, selections);
    if (!provider.edit) throw new ProviderError("UNSUPPORTED_CAPABILITY", "Provider does not implement editing.");
    return provider.edit(request, model);
  }
}
