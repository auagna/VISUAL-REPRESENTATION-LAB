import { getAttribute } from "@/representation/schema";
import { GenerationRequest, ImageProvider } from "./imageProvider";
import { MODEL_REGISTRY } from "@/ai/modelRegistry";
import type { AIImageProvider, ConnectionTestResult, GeneratedImage as RoutedGeneratedImage, ImageEditRequest, ImageGenerationRequest, ModelDefinition } from "@/ai/types";

function hash(input: string) { let value = 0; for (let i = 0; i < input.length; i++) value = ((value << 5) - value + input.charCodeAt(i)) | 0; return Math.abs(value) }
function esc(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!) }

export class MockImageProvider implements ImageProvider {
  readonly name = "mock";
  async generate({ state, prompt, seed }: GenerationRequest) {
    const h = hash(prompt + seed); const detail = getAttribute(state, "detailDensity").strength; const palette = getAttribute(state, "palette").value; const medium = getAttribute(state, "medium").value;
    const lines = Math.max(3, Math.round(detail / 8));
    const strokes = Array.from({ length: lines }, (_, i) => { const y = 155 + i * (115 / lines); const offset = ((h >> (i % 16)) & 15) - 7; return `<path d="M${90 + offset} ${y} L${220 + offset} ${90 + i * 2} L${430 - offset} ${y} L${430 - offset} 320 L${90 + offset} 320 Z" fill="none" stroke="#20201e" stroke-width="${1 + (detail / 100) * 2}" opacity="${0.24 + i / lines * 0.55}"/>` }).join("");
    const accent = palette.includes("cyan") ? "#ef5b43" : palette.includes("warm") ? "#b66c45" : palette.includes("monochrome") ? "#232321" : "#607a74";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="390"><rect width="520" height="390" fill="#e9e5dc"/><circle cx="430" cy="72" r="38" fill="${accent}" opacity=".75"/><path d="M0 322 Q150 292 280 326 T520 310 V390 H0Z" fill="#c7c3b8"/>${strokes}<g stroke="#31423c" stroke-width="3" opacity=".72"><path d="M65 320V180l-30 140m30-102-24-18m24 45-30 20M468 320V160l28 160m-28-115 22-20m-22 55 29 18"/></g><text x="24" y="32" font-family="monospace" font-size="12" fill="#555">MOCK OUTPUT · ${esc(medium.toUpperCase())}</text><text x="24" y="370" font-family="monospace" font-size="11" fill="#666">detail ${detail} · seed ${esc(seed.slice(0, 8))}</text></svg>`;
    return [{ id: `img-${h}`, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, alt: "Deterministic mock architectural result" }];
  }
}

/** Provider-router adapter. Mock stays explicit, deterministic, and offline. */
export class RoutedMockImageProvider implements AIImageProvider {
  readonly id = "mock";
  readonly name = "Mock";
  async testConnection(): Promise<ConnectionTestResult> { return { status: "connected", message: "Offline provider available." }; }
  async listModels() { return MODEL_REGISTRY.filter((model) => model.providerId === this.id); }
  async generate(request: ImageGenerationRequest, model: ModelDefinition): Promise<RoutedGeneratedImage[]> {
    const provider = new MockImageProvider();
    const result = await provider.generate({ state: request.representationState, prompt: request.compiledInstruction, seed: "vrl-v03-fixed-seed" });
    return result.map((image) => ({ id: image.id, url: image.url, mimeType: "image/svg+xml", providerId: this.id, modelId: model.id, createdAt: new Date().toISOString(), metadata: { alt: image.alt, deterministic: true } }));
  }
  async edit(request: ImageEditRequest, model: ModelDefinition) { return this.generate({ ...request, sourceImages: [request.sourceImage] }, model); }
}
