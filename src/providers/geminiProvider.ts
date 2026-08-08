import { MODEL_REGISTRY } from "@/ai/modelRegistry";
import { ProviderError, type AIImageProvider, type ConnectionTestResult, type GeneratedImage, type ImageAsset, type ImageEditRequest, type ImageGenerationRequest, type ModelDefinition } from "@/ai/types";

function ensureServer() { if (typeof window !== "undefined") throw new ProviderError("AUTH_ERROR", "Gemini provider is server-side only."); }
function inlinePart(asset?: ImageAsset) {
  if (!asset?.dataUrl) return null;
  const match = asset.dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s); if (!match) return null;
  return { inline_data: { mime_type: match[1] || asset.mimeType, data: match[2] ? match[3] : Buffer.from(decodeURIComponent(match[3])).toString("base64") } };
}

export class GeminiImageProvider implements AIImageProvider {
  readonly id = "google";
  readonly name = "Google Gemini";
  constructor(private apiKey: string) { ensureServer(); }
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.apiKey) return { status: "not_connected", message: "GEMINI_API_KEY is not configured." };
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image", { headers: { "x-goog-api-key": this.apiKey } });
    return response.ok ? { status: "connected", message: "Gemini image models are accessible." } : { status: response.status === 401 || response.status === 403 ? "invalid_key" : response.status === 429 ? "rate_limited" : "unavailable", message: `Gemini HTTP ${response.status}` };
  }
  async listModels() { return MODEL_REGISTRY.filter((model) => model.providerId === this.id); }
  private async execute(request: ImageGenerationRequest | ImageEditRequest, model: ModelDefinition): Promise<GeneratedImage[]> {
    const parts: Array<Record<string, unknown>> = [{ text: request.compiledInstruction }];
    if ("sourceImage" in request) { const source = inlinePart(request.sourceImage); if (source) parts.push(source); }
    for (const reference of request.references || []) { const part = inlinePart(reference); if (part) parts.push(part); }
    const quality = ["1K", "2K", "4K"].includes(request.quality || "") ? request.quality : "2K";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`, { method: "POST", headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: request.aspectRatio || "1:1", imageSize: quality } } }) });
    const payload = await response.json();
    if (!response.ok) throw new ProviderError(response.status === 401 || response.status === 403 ? "AUTH_ERROR" : response.status === 429 ? "RATE_LIMIT" : "INVALID_REQUEST", payload?.error?.message || `Gemini HTTP ${response.status}`);
    return (payload.candidates?.[0]?.content?.parts || []).filter((part: { inlineData?: unknown; thought?: boolean }) => part.inlineData && !part.thought).map((part: { inlineData: { mimeType?: string; data: string } }, index: number) => ({ id: `google-${Date.now()}-${index}`, dataUrl: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`, mimeType: part.inlineData.mimeType || "image/png", providerId: this.id, modelId: model.id, createdAt: new Date().toISOString(), metadata: { finishReason: payload.candidates?.[0]?.finishReason } }));
  }
  generate(request: ImageGenerationRequest, model: ModelDefinition) { return this.execute(request, model); }
  edit(request: ImageEditRequest, model: ModelDefinition) { return this.execute(request, model); }
}
