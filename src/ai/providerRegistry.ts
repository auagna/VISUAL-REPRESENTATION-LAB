export const PROVIDER_REGISTRY = [
  { id: "openai", name: "OpenAI", environmentKey: "OPENAI_API_KEY", mode: "real" as const },
  { id: "google", name: "Google Gemini", environmentKey: "GEMINI_API_KEY", mode: "real" as const },
  { id: "mock", name: "Mock", mode: "offline" as const },
];
