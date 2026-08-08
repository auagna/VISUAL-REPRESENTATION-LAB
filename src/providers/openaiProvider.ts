import { MODEL_REGISTRY } from "@/ai/modelRegistry";
import { ProviderError, type AIImageProvider, type ConnectionTestResult, type GeneratedImage, type ImageAsset, type ImageEditRequest, type ImageGenerationRequest, type ModelDefinition } from "@/ai/types";

function ensureServer() { if (typeof window !== "undefined") throw new ProviderError("AUTH_ERROR", "OpenAI provider is server-side only."); }
function decode(asset: ImageAsset) {
  if (!asset.dataUrl) throw new ProviderError("INVALID_REQUEST", "A data URL image asset is required.");
  const match = asset.dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new ProviderError("INVALID_REQUEST", "Invalid image data URL.");
  return { mimeType: match[1] || asset.mimeType, bytes: match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3])) };
}
function sizeForAspect(ratio?: string) { return ({ "1:1": "1024x1024", "2:3": "1024x1536", "3:4": "1024x1536", "9:16": "1024x1536", "3:2": "1536x1024", "4:3": "1536x1024", "16:9": "1536x1024" } as Record<string,string>)[ratio || ""] || "auto"; }

export class OpenAIImageProvider implements AIImageProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
  constructor(private apiKey: string) { ensureServer(); }
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.apiKey) return { status: "not_connected", message: "OPENAI_API_KEY is not configured." };
    const response = await fetch("https://api.openai.com/v1/models/gpt-image-2", { headers: { Authorization: `Bearer ${this.apiKey}` } });
    return response.ok ? { status: "connected", message: "GPT Image 2 is accessible." } : { status: response.status === 401 ? "invalid_key" : response.status === 429 ? "rate_limited" : "unavailable", message: `OpenAI HTTP ${response.status}` };
  }
  async listModels() { return MODEL_REGISTRY.filter((model) => model.providerId === this.id); }
  private async parse(response: Response, model: ModelDefinition, operation: string): Promise<GeneratedImage[]> {
    const payload = await response.json();
    if (!response.ok) throw new ProviderError(response.status === 401 ? "AUTH_ERROR" : response.status === 429 ? "RATE_LIMIT" : "INVALID_REQUEST", payload?.error?.message || `OpenAI HTTP ${response.status}`);
    return (payload.data || []).map((item: { b64_json: string; revised_prompt?: string }, index: number) => ({ id: `openai-${Date.now()}-${index}`, dataUrl: `data:image/png;base64,${item.b64_json}`, mimeType: "image/png", providerId: this.id, modelId: model.id, createdAt: new Date().toISOString(), metadata: { operation, revisedPrompt: item.revised_prompt } }));
  }
  async generate(request: ImageGenerationRequest, model: ModelDefinition) {
    const response = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: model.id, prompt: request.compiledInstruction, n: request.count || 1, size: sizeForAspect(request.aspectRatio), quality: request.quality || "high", output_format: "png" }) });
    return this.parse(response, model, "generation");
  }
  async edit(request: ImageEditRequest, model: ModelDefinition) {
    const source = decode(request.sourceImage), form = new FormData();
    form.append("model", model.id); form.append("prompt", request.compiledInstruction); form.append("image[]", new Blob([source.bytes], { type: source.mimeType }), "source.png");
    if (request.mask) { const mask = decode(request.mask); form.append("mask", new Blob([mask.bytes], { type: mask.mimeType }), "mask.png"); }
    for (const [index, reference] of (request.references || []).entries()) { const ref = decode(reference); form.append("image[]", new Blob([ref.bytes], { type: ref.mimeType }), `reference-${index + 1}.png`); }
    form.append("size", sizeForAspect(request.aspectRatio)); form.append("quality", request.quality || "high"); form.append("output_format", "png");
    return this.parse(await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}` }, body: form }), model, request.mask ? "maskEditing" : "editing");
  }
}
