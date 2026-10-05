// Shared by the settings page (client) and AI routes (server).
// The suggested lists are only a starting point: the settings page also loads the live
// model list from the provider's API, so new models show up without a code change.

export interface AIModelOption {
  id: string;
  name: string;
  tag?: string;
}

export interface AIProvider {
  id: "google" | "openai" | "anthropic";
  name: string;
  description: string;
  defaultModel: string;
  suggested: AIModelOption[];
  keyPlaceholder: string;
  keyUrl: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "google",
    name: "Google AI",
    description: "Gemini models - có free tier",
    defaultModel: "gemini-3.5-flash",
    suggested: [
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", tag: "Khuyên dùng" },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", tag: "Rẻ nhất" },
    ],
    keyPlaceholder: "AIza...",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models",
    defaultModel: "gpt-5.4-mini",
    suggested: [
      { id: "gpt-5.4-mini", name: "GPT-5.4 mini", tag: "Rẻ, nhanh" },
      { id: "gpt-5.4-nano", name: "GPT-5.4 nano", tag: "Rẻ nhất" },
      { id: "gpt-5.5", name: "GPT-5.5", tag: "Chính xác" },
    ],
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models",
    defaultModel: "claude-haiku-4-5-20251001",
    suggested: [
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", tag: "Rẻ, nhanh" },
      { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", tag: "Chính xác" },
    ],
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
];

export function getDefaultModel(provider: string): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "";
}

/**
 * Whether to send temperature=0. OpenAI reasoning models (gpt-5+, o-series) reject any
 * non-default temperature, and Google recommends keeping the default for Gemini 3+.
 */
export function supportsZeroTemperature(provider: string, model: string): boolean {
  if (provider === "openai") return !/^(o\d|gpt-([5-9]|\d{2}))/.test(model) || model.includes("-chat");
  if (provider === "google") return !/^gemini-([3-9]|\d{2})/.test(model);
  return true;
}
