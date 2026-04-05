import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function POST() {
  try {
    const userId = await requireAuth();
    const settings = await prisma.userSettings.findUnique({ where: { userId } });

    if (!settings?.aiProvider || !settings?.aiApiKey) {
      return error("Chưa cấu hình AI provider hoặc API key", 400);
    }

    const { aiProvider, aiApiKey, aiModel } = settings;

    switch (aiProvider) {
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${aiApiKey}` },
        });
        if (!res.ok) {
          const data = await res.json();
          return error(data.error?.message || "API key không hợp lệ", 400);
        }
        return success({ provider: "OpenAI", status: "connected" });
      }

      case "google": {
        const model = aiModel || "gemini-2.0-flash";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${aiApiKey}`
        );
        if (!res.ok) {
          const data = await res.json();
          return error(data.error?.message || "API key không hợp lệ", 400);
        }
        return success({ provider: "Google AI", status: "connected" });
      }

      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": aiApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: aiModel || "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          return error(data.error?.message || "API key không hợp lệ", 400);
        }
        return success({ provider: "Anthropic", status: "connected" });
      }

      default:
        return error("Provider không hỗ trợ", 400);
    }
  } catch (err) {
    return handleApiError(err);
  }
}
