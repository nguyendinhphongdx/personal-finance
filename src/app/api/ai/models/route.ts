import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";
import type { AIModelOption } from "@/lib/ai-models";

// Chat models only: drop audio/image/embedding/realtime variants that can't do text tool-calling.
const OPENAI_EXCLUDE = /(audio|realtime|tts|transcribe|image|search|embedding|moderation|instruct|codex|computer-use|-\d{4}-\d{2}-\d{2}$)/;
const GOOGLE_EXCLUDE = /(embedding|tts|image|audio|live|aqa|robotics|computer-use|native)/;

async function listOpenAI(apiKey: string): Promise<AIModelOption[]> {
  const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "API key không hợp lệ");
  return (data.data as { id: string; created: number }[])
    .filter((m) => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !OPENAI_EXCLUDE.test(m.id))
    .sort((a, b) => b.created - a.created)
    .map((m) => ({ id: m.id, name: m.id }));
}

async function listGoogle(apiKey: string): Promise<AIModelOption[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "API key không hợp lệ");
  return (data.models as { name: string; displayName?: string; supportedGenerationMethods?: string[] }[])
    .map((m) => ({ ...m, id: m.name.replace(/^models\//, "") }))
    .filter((m) => m.id.startsWith("gemini-") && m.supportedGenerationMethods?.includes("generateContent") && !GOOGLE_EXCLUDE.test(m.id))
    .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))
    .map((m) => ({ id: m.id, name: m.displayName || m.id }));
}

async function listAnthropic(apiKey: string): Promise<AIModelOption[]> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "API key không hợp lệ");
  // Returned newest first
  return (data.data as { id: string; display_name?: string }[]).map((m) => ({ id: m.id, name: m.display_name || m.id }));
}

/**
 * List the models the user's API key can actually use. Accepts a freshly typed key so the
 * list can load before saving; otherwise falls back to the saved key for that provider.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { provider, apiKey } = await req.json();

    let key = typeof apiKey === "string" && apiKey && !apiKey.includes("...") ? apiKey : null;
    if (!key) {
      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      if (settings?.aiProvider === provider) key = settings?.aiApiKey ?? null;
    }
    if (!key) return error("Nhập API key để tải danh sách model");

    try {
      switch (provider) {
        case "openai": return success(await listOpenAI(key));
        case "google": return success(await listGoogle(key));
        case "anthropic": return success(await listAnthropic(key));
        default: return error("Provider không hỗ trợ");
      }
    } catch (err) {
      return error(err instanceof Error ? err.message : "Không tải được danh sách model", 502);
    }
  } catch (err) {
    return handleApiError(err);
  }
}
