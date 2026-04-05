import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

const SYSTEM_PROMPT = `Bạn là trợ lý tài chính. Nhiệm vụ: phân tích câu nói tiếng Việt và trích xuất thông tin giao dịch.

Trả về JSON với format:
{
  "type": "INCOME" hoặc "EXPENSE",
  "amount": số tiền (number, đơn vị VND),
  "description": mô tả ngắn gọn (string),
  "categoryHint": tên danh mục phù hợp nhất từ danh sách
}

Danh mục chi tiêu: Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Giải trí, Sức khỏe, Khác
Danh mục thu nhập: Lương, Thu nhập khác, Tiền nhà

Quy tắc:
- "nghìn" hoặc "ngàn" = ×1.000, "triệu" = ×1.000.000, "k" = ×1.000
- Mặc định là EXPENSE trừ khi có từ khóa thu nhập (lương, thưởng, thu nhập, nhận tiền)
- Description nên ngắn gọn, bỏ số tiền và noise words
- Chỉ trả về JSON, không giải thích`;

async function callOpenAI(apiKey: string, model: string, text: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI API error");
  return JSON.parse(data.choices[0].message.content);
}

async function callGoogle(apiKey: string, model: string, text: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nInput: ${text}` }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Google AI API error");
  const content = data.candidates[0].content.parts[0].text;
  return JSON.parse(content);
}

async function callAnthropic(apiKey: string, model: string, text: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Anthropic API error");
  const content = data.content[0].text;
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Không thể parse response từ AI");
  return JSON.parse(jsonMatch[0]);
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { text } = await req.json();
    if (!text) return error("Thiếu nội dung");

    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.aiProvider || !settings?.aiApiKey) {
      return error("Chưa cấu hình AI. Vào Cài đặt → AI để thiết lập.", 400);
    }

    const { aiProvider, aiModel, aiApiKey } = settings;
    const model = aiModel || getDefaultModel(aiProvider);

    let result;
    switch (aiProvider) {
      case "openai":
        result = await callOpenAI(aiApiKey, model, text);
        break;
      case "google":
        result = await callGoogle(aiApiKey, model, text);
        break;
      case "anthropic":
        result = await callAnthropic(aiApiKey, model, text);
        break;
      default:
        return error("Provider không hỗ trợ");
    }

    return success(result);
  } catch (err) {
    return handleApiError(err);
  }
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai": return "gpt-4o-mini";
    case "google": return "gemini-2.0-flash";
    case "anthropic": return "claude-haiku-4-5-20251001";
    default: return "";
  }
}
