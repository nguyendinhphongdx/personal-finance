import { NextRequest } from "next/server";
import { createAgent } from "langchain";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";
import { getChatModel } from "@/lib/agent/model";
import { tools, WRITE_TOOLS, type ToolResult } from "@/lib/agent/tools";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import { sanitizeContext, type AgentAction } from "@/lib/agent/context";

// A turn can take several model ↔ tool round trips.
export const maxDuration = 60;

const HISTORY_LIMIT = 20; // messages (≈10 turns) replayed to the model
const MAX_IMAGES = 3;
const MAX_IMAGE_BASE64 = 6_000_000; // ≈4.5MB decoded
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Attachment { mimeType: string; data: string } // data: base64 without the data: prefix

export async function GET() {
  try {
    return await withUserContext(async (userId) => {
      const rows = await prisma.agentMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return success(rows.reverse());
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  try {
    return await withUserContext(async (userId) => {
      await prisma.agentMessage.deleteMany({ where: { userId } });
      return success({ deleted: true });
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withUserContext(async (userId) => {
      const body = await req.json();
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const attachments: Attachment[] = Array.isArray(body.attachments) ? body.attachments : [];
      const context = sanitizeContext(body.context);

      if (!message && attachments.length === 0) return error("Thiếu nội dung");
      if (attachments.length > MAX_IMAGES) return error(`Tối đa ${MAX_IMAGES} ảnh`);
      for (const a of attachments) {
        if (!IMAGE_TYPES.includes(a?.mimeType) || typeof a.data !== "string") return error("Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF");
        if (a.data.length > MAX_IMAGE_BASE64) return error("Ảnh quá lớn (tối đa ~4MB)");
      }

      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      if (!settings?.aiProvider || !settings?.aiApiKey) {
        return error("Chưa cấu hình AI. Vào Cài đặt → AI để thiết lập.");
      }

      const agent = createAgent({
        model: getChatModel(settings.aiProvider, settings.aiModel, settings.aiApiKey),
        tools,
        systemPrompt: buildSystemPrompt(context),
      });

      // History: only visible text of past turns. Images are not replayed.
      const history = await prisma.agentMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      });
      const messages: BaseMessage[] = history.reverse().map(toLangChainMessage);
      // History must start with a user turn for some providers
      while (messages.length > 0 && messages[0].getType() !== "human") messages.shift();

      const text = message || "(Xem ảnh đính kèm)";
      messages.push(
        attachments.length === 0
          ? new HumanMessage(text)
          : new HumanMessage({
              content: [
                { type: "text", text },
                ...attachments.map((a) => ({ type: "image_url" as const, image_url: { url: `data:${a.mimeType};base64,${a.data}` } })),
              ],
            })
      );

      let result;
      try {
        result = await agent.invoke({ messages }, { recursionLimit: 25 });
      } catch (err) {
        console.error("[agent]", err);
        const msg = err instanceof Error ? err.message : String(err);
        if (/recursion/i.test(msg)) return error("Yêu cầu quá phức tạp, hãy chia nhỏ ra.", 502);
        return error(`AI gặp lỗi: ${msg.slice(0, 300)}`, 502);
      }

      const produced = result.messages.slice(messages.length);
      const actions: AgentAction[] = produced
        .filter((m) => m.getType() === "tool")
        .map((m) => {
          const name = m.name ?? "unknown";
          let parsed: ToolResult;
          try {
            parsed = JSON.parse(m.text);
          } catch {
            parsed = { ok: false, summary: m.text.slice(0, 200) };
          }
          const write = WRITE_TOOLS.has(name);
          return { tool: name, ok: parsed.ok, summary: parsed.summary, write, ...(write && parsed.data ? { data: parsed.data } : {}) };
        });

      const last = produced.at(-1);
      const reply = (last && last.getType() === "ai" ? last.text : "").trim() || "Đã xong.";

      // Explicit timestamps keep the user → assistant order stable
      const now = Date.now();
      const [userMsg, assistantMsg] = await prisma.$transaction([
        prisma.agentMessage.create({
          data: {
            userId, role: "user", content: message, createdAt: new Date(now),
            attachments: attachments.length ? attachments.map((a) => ({ mimeType: a.mimeType, size: Math.round(a.data.length * 0.75) })) : undefined,
            context: (context ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        }),
        prisma.agentMessage.create({
          data: {
            userId, role: "assistant", content: reply, createdAt: new Date(now + 1),
            actions: actions.length ? (actions as unknown as Prisma.InputJsonValue) : undefined,
          },
        }),
      ]);

      return success({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        changed: actions.some((a) => a.write && a.ok),
      });
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function toLangChainMessage(row: { role: string; content: string; actions: Prisma.JsonValue; attachments: Prisma.JsonValue }): BaseMessage {
  if (row.role === "user") {
    const n = Array.isArray(row.attachments) ? row.attachments.length : 0;
    return new HumanMessage(row.content + (n ? `\n[Đã đính kèm ${n} ảnh]` : ""));
  }
  // Fold what the assistant did into its reply so follow-ups ("sửa lại cái vừa tạo") have the ids.
  const done = (Array.isArray(row.actions) ? (row.actions as unknown as AgentAction[]) : []).filter((a) => a.write);
  const note = done.length
    ? "\n\n[Đã thực hiện: " + done.map((a) => `${a.tool} ${a.ok ? "OK" : "LỖI"} – ${a.summary}${a.data ? " " + JSON.stringify(a.data) : ""}`).join("; ") + "]"
    : "";
  return new AIMessage(row.content + note);
}
