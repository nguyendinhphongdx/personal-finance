import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BadRequestError } from "@/lib/errors";
import { getDefaultModel, supportsZeroTemperature } from "@/lib/ai-models";

/** Build a tool-calling chat model for the provider configured in the user's Settings. */
export function getChatModel(provider: string, model: string | null, apiKey: string): BaseChatModel {
  const name = model || getDefaultModel(provider);
  const temperature = supportsZeroTemperature(provider, name) ? { temperature: 0 } : {};
  switch (provider) {
    case "openai":
      return new ChatOpenAI({ apiKey, model: name, ...temperature });
    case "anthropic":
      return new ChatAnthropic({ apiKey, model: name, ...temperature, maxTokens: 2048 });
    case "google":
      return new ChatGoogleGenerativeAI({ apiKey, model: name, ...temperature });
    default:
      throw new BadRequestError("Provider không hỗ trợ");
  }
}
