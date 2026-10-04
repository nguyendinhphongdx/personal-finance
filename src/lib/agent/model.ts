import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BadRequestError } from "@/lib/errors";

export function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai": return "gpt-4o-mini";
    case "google": return "gemini-2.0-flash";
    case "anthropic": return "claude-haiku-4-5-20251001";
    default: return "";
  }
}

/** Build a tool-calling chat model for the provider configured in the user's Settings. */
export function getChatModel(provider: string, model: string | null, apiKey: string): BaseChatModel {
  const name = model || getDefaultModel(provider);
  switch (provider) {
    case "openai":
      return new ChatOpenAI({ apiKey, model: name, temperature: 0 });
    case "anthropic":
      return new ChatAnthropic({ apiKey, model: name, temperature: 0, maxTokens: 2048 });
    case "google":
      return new ChatGoogleGenerativeAI({ apiKey, model: name, temperature: 0 });
    default:
      throw new BadRequestError("Provider không hỗ trợ");
  }
}
