import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const staticRoot = join(projectRoot, "standalone");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

function loadEnvFile() {
  const envPath = join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
loadEnvFile();

const modelRegistry = [
  { id: "mock-image-v1", providerId: "mock", name: "Mock Image v1", capabilities: { generation: true, editing: true, maskEditing: true, imageInput: true, multiReference: true } },
  { id: "gpt-image-2", providerId: "openai", name: "GPT Image 2", capabilities: { generation: true, editing: true, maskEditing: true, imageInput: true, multiReference: true } },
  { id: "gemini-3.1-flash-lite-image", providerId: "google", name: "Gemini 3.1 Flash Lite Image", capabilities: { generation: true, editing: true, maskEditing: false, imageInput: true, multiReference: false } },
  { id: "gemini-3.1-flash-image", providerId: "google", name: "Gemini 3.1 Flash Image", capabilities: { generation: true, editing: true, maskEditing: false, imageInput: true, multiReference: true } },
  { id: "gemini-3-pro-image", providerId: "google", name: "Gemini 3 Pro Image", capabilities: { generation: true, editing: true, maskEditing: false, imageInput: true, multiReference: true } },
];

const json = (response, status, body) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
const providerStatuses = () => ({ openai: process.env.OPENAI_API_KEY ? "connected" : "not_connected", google: process.env.GEMINI_API_KEY ? "connected" : "not_connected", mock: "connected" });
const normalizeProviderError = (error, responseStatus = 0) => {
  const message = error?.error?.message || error?.message || "Unknown provider error.";
  let code = "UNKNOWN";
  if (responseStatus === 401 || responseStatus === 403) code = "AUTH_ERROR";
  else if (responseStatus === 429) code = "RATE_LIMIT";
  else if (responseStatus === 404) code = "MODEL_UNAVAILABLE";
  else if (responseStatus >= 400 && responseStatus < 500) code = /safety|policy/i.test(message) ? "SAFETY_REJECTION" : "INVALID_REQUEST";
  else if (responseStatus >= 500) code = "MODEL_UNAVAILABLE";
  else if (error instanceof TypeError) code = "NETWORK_ERROR";
  return { code, message };
};
const dataUrlAsset = (asset) => {
  if (!asset?.dataUrl) return null;
  const match = asset.dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const mimeType = match[1] || asset.mimeType || "image/png";
  const bytes = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
  return { mimeType, bytes };
};
const sizeForAspect = (ratio) => ({ "1:1": "1024x1024", "3:2": "1536x1024", "4:3": "1536x1024", "16:9": "1536x1024", "2:3": "1024x1536", "3:4": "1024x1536", "9:16": "1024x1536" }[ratio] || "auto");

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload?.error?.message || `Provider HTTP ${response.status}`); error.payload = payload; error.status = response.status; throw error; }
  return { payload, headers: response.headers };
}

async function testConnection(providerId) {
  if (providerId === "mock") return { status: "connected", message: "Offline provider available." };
  if (providerId === "openai") {
    if (!process.env.OPENAI_API_KEY) return { status: "not_connected", message: "OPENAI_API_KEY is not configured." };
    await fetchJson("https://api.openai.com/v1/models/gpt-image-2", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
    return { status: "connected", message: "GPT Image 2 is accessible." };
  }
  if (!process.env.GEMINI_API_KEY) return { status: "not_connected", message: "GEMINI_API_KEY is not configured." };
  await fetchJson("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image", { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY } });
  return { status: "connected", message: "Gemini image models are accessible." };
}

async function openAIRequest(model, operation, request) {
  if (!process.env.OPENAI_API_KEY) { const error = new Error("OPENAI_API_KEY is not configured."); error.status = 401; throw error; }
  const headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
  let payload;
  if (operation === "generation") {
    ({ payload } = await fetchJson("https://api.openai.com/v1/images/generations", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ model: model.id, prompt: request.compiledInstruction, n: request.count || 1, size: sizeForAspect(request.aspectRatio), quality: request.quality || "high", output_format: "png" }) }));
  } else {
    const source = dataUrlAsset(request.sourceImage);
    if (!source) { const error = new Error("A data URL source image is required for editing."); error.status = 400; throw error; }
    const form = new FormData();
    form.append("model", model.id); form.append("prompt", request.compiledInstruction); form.append("image[]", new Blob([source.bytes], { type: source.mimeType }), "source.png");
    const mask = dataUrlAsset(request.mask); if (mask) form.append("mask", new Blob([mask.bytes], { type: mask.mimeType }), "mask.png");
    for (const [index, asset] of (request.references || []).entries()) { const ref = dataUrlAsset(asset); if (ref) form.append("image[]", new Blob([ref.bytes], { type: ref.mimeType }), `reference-${index + 1}.png`); }
    form.append("size", sizeForAspect(request.aspectRatio)); form.append("quality", request.quality || "high"); form.append("output_format", "png");
    ({ payload } = await fetchJson("https://api.openai.com/v1/images/edits", { method: "POST", headers, body: form }));
  }
  return (payload.data || []).map((item, index) => ({ id: `openai-${Date.now()}-${index}`, dataUrl: `data:image/png;base64,${item.b64_json}`, mimeType: "image/png", providerId: "openai", modelId: model.id, createdAt: new Date().toISOString(), metadata: { revisedPrompt: item.revised_prompt || null, operation } }));
}

async function geminiRequest(model, _operation, request) {
  if (!process.env.GEMINI_API_KEY) { const error = new Error("GEMINI_API_KEY is not configured."); error.status = 401; throw error; }
  const parts = [{ text: request.compiledInstruction }];
  for (const asset of [request.sourceImage, ...(request.references || [])].filter(Boolean)) { const parsed = dataUrlAsset(asset); if (parsed) parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.bytes.toString("base64") } }); }
  const imageSize = ["1K", "2K", "4K"].includes(request.quality) ? request.quality : "2K";
  const { payload } = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`, { method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: request.aspectRatio || "1:1", imageSize } } }) });
  const outputParts = payload.candidates?.[0]?.content?.parts || [];
  return outputParts.filter((part) => part.inlineData && !part.thought).map((part, index) => ({ id: `google-${Date.now()}-${index}`, dataUrl: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`, mimeType: part.inlineData.mimeType || "image/png", providerId: "google", modelId: model.id, createdAt: new Date().toISOString(), metadata: { finishReason: payload.candidates?.[0]?.finishReason || null } }));
}

async function readBody(request) {
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 30 * 1024 * 1024) throw Object.assign(new Error("Request body is too large."), { status: 413 }); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function api(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/ai/status") return json(response, 200, { providers: providerStatuses(), models: modelRegistry });
  if (request.method === "POST" && pathname === "/api/ai/test") {
    try { const body = await readBody(request); return json(response, 200, await testConnection(body.providerId)); }
    catch (error) { const normalized = normalizeProviderError(error.payload || error, error.status); return json(response, error.status || 500, { status: normalized.code === "AUTH_ERROR" ? "invalid_key" : normalized.code === "RATE_LIMIT" ? "rate_limited" : "unavailable", message: normalized.message }); }
  }
  if (request.method === "POST" && pathname === "/api/ai/generate") {
    try {
      const body = await readBody(request); const model = modelRegistry.find((item) => item.id === body.modelId && item.providerId === body.providerId);
      if (!model) return json(response, 404, { error: { code: "MODEL_UNAVAILABLE", message: "Model is not registered." } });
      const capability = body.operation === "edit" ? (body.request?.mask ? "maskEditing" : "editing") : (body.request?.references?.length ? "imageInput" : "generation");
      if (!model.capabilities[capability]) return json(response, 422, { error: { code: "UNSUPPORTED_CAPABILITY", message: "MODEL DOES NOT SUPPORT THIS OPERATION", details: { compatibleModels: modelRegistry.filter((item) => item.capabilities[capability]).map((item) => item.id) } } });
      const images = body.providerId === "openai" ? await openAIRequest(model, body.operation, body.request) : body.providerId === "google" ? await geminiRequest(model, body.operation, body.request) : [];
      return json(response, 200, { images });
    } catch (error) { const normalized = normalizeProviderError(error.payload || error, error.status); return json(response, error.status || 500, { error: normalized }); }
  }
  return json(response, 404, { error: { code: "NOT_FOUND", message: "Unknown API route." } });
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = normalize(join(staticRoot, requested));
  if (!filePath.startsWith(staticRoot)) return json(response, 403, { error: { code: "FORBIDDEN" } });
  try { const info = await stat(filePath); if (!info.isFile()) throw new Error("Not a file"); const content = await readFile(filePath); response.writeHead(200, { "Content-Type": mime[extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" }); response.end(content); }
  catch { const content = await readFile(join(staticRoot, "index.html")); response.writeHead(200, { "Content-Type": mime[".html"], "Cache-Control": "no-cache" }); response.end(content); }
}

createServer(async (request, response) => {
  try { const pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname; if (pathname.startsWith("/api/")) return await api(request, response, pathname); await serveStatic(response, pathname); }
  catch (error) { json(response, 500, { error: { code: "UNKNOWN", message: error.message } }); }
}).listen(port, host, () => console.log(`VRL server listening on http://${host}:${port}`));
