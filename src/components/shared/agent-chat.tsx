"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VoiceInput } from "@/components/shared/voice-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAgentContextStore, AGENT_DATA_CHANGED } from "@/stores/agent-context.store";
import type { AgentAction, AgentContext } from "@/lib/agent/context";
import { cn } from "@/lib/utils";
import { Sparkles, Send, ImagePlus, X, Loader2, CheckCircle2, XCircle, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AgentAction[] | null;
  attachments?: { mimeType: string; size: number }[] | null;
}

interface PendingImage { mimeType: string; data: string; preview: string }

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const TAB_LABELS: Record<string, string> = {
  rooms: "Phòng", tenants: "Người thuê", billing: "Hóa đơn", fees: "Loại phí", info: "Thông tin",
};

function describeContext(ctx: AgentContext): string | null {
  if (!ctx.propertyId) return null;
  return [
    ctx.propertyName,
    ctx.activeTab && TAB_LABELS[ctx.activeTab],
    ctx.month && ctx.year && `${ctx.month}/${ctx.year}`,
  ].filter(Boolean).join(" · ");
}

function readImage(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve({ mimeType: file.type, data: url.slice(url.indexOf(",") + 1), preview: url });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AgentChat() {
  const pathname = usePathname();
  const storedContext = useAgentContextStore((s) => s.context);
  // A page's context only counts while that page is open
  const context: AgentContext = storedContext?.route === pathname ? storedContext : { route: pathname };
  const contextLabel = describeContext(context);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [sending, setSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || historyLoaded) return;
    fetch("/api/ai/agent")
      .then((r) => r.json())
      .then((d) => { if (d.success) setMessages(d.data); })
      .finally(() => setHistoryLoaded(true));
  }, [open, historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  const handleVoice = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    if (images.length + list.length > MAX_IMAGES) { toast.error(`Tối đa ${MAX_IMAGES} ảnh`); return; }
    for (const f of list) {
      if (!f.type.startsWith("image/")) { toast.error("Chỉ hỗ trợ ảnh"); return; }
      if (f.size > MAX_IMAGE_BYTES) { toast.error(`Ảnh ${f.name} quá lớn (tối đa 4MB)`); return; }
    }
    const read = await Promise.all(list.map(readImage));
    setImages((prev) => [...prev, ...read]);
  }

  async function send() {
    const text = input.trim();
    if ((!text && images.length === 0) || sending) return;

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`, role: "user", content: text,
      attachments: images.map((i) => ({ mimeType: i.mimeType, size: i.data.length })),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    const sentImages = images;
    setImages([]);
    setSending(true);

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          attachments: sentImages.map(({ mimeType, data }) => ({ mimeType, data })),
          context,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), d.data.userMessage, d.data.assistantMessage]);
      if (d.data.changed) window.dispatchEvent(new Event(AGENT_DATA_CHANGED));
    } catch (err) {
      // Put the message back so the user can retry
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
      setImages(sentImages);
      toast.error(err instanceof Error && err.message ? err.message : "Gửi thất bại");
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    const res = await fetch("/api/ai/agent", { method: "DELETE" });
    if (res.ok) { setMessages([]); toast.success("Đã xóa lịch sử trò chuyện"); }
  }

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-12 w-12 rounded-full shadow-lg cursor-pointer"
          aria-label="Mở trợ lý AI"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-0 gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="border-b pr-12">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Trợ lý AI</SheetTitle>
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => setConfirmClear(true)} aria-label="Xóa lịch sử">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <SheetDescription className="truncate">
              {contextLabel ? `Đang xem: ${contextLabel}` : "Nói hoặc gõ việc cần làm, VD: ăn phở 50k"}
            </SheetDescription>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!historyLoaded ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2 py-4">
                <p>Ví dụ:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>đổ xăng 80k</li>
                  <li>tạo hóa đơn tháng này</li>
                  <li>phòng 302 điện 120 số</li>
                  <li>thêm phí sửa vòi nước 150k cho phòng 201</li>
                  <li>gửi ảnh đồng hồ điện để điền số</li>
                </ul>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="border-t p-3 space-y-2">
            {images.length > 0 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                    <img src={img.preview} alt="" className="h-14 w-14 rounded-md object-cover border" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-background border p-0.5 cursor-pointer"
                      aria-label="Bỏ ảnh"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
              }}
              placeholder="Nhập yêu cầu..."
              rows={2}
              className="resize-none text-sm"
              disabled={sending}
            />
            <div className="flex items-center gap-2">
              <VoiceInput onResult={handleVoice} />
              <Button type="button" variant="outline" size="icon" className="cursor-pointer shrink-0"
                onClick={() => fileRef.current?.click()} disabled={sending || images.length >= MAX_IMAGES} aria-label="Đính kèm ảnh">
                <ImagePlus className="h-4 w-4" />
              </Button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
              <Button className="ml-auto cursor-pointer" onClick={send} disabled={sending || (!input.trim() && images.length === 0)}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-1">Gửi</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Xóa lịch sử trò chuyện?"
        description="Trợ lý sẽ không còn nhớ các trao đổi trước. Dữ liệu đã tạo/sửa không bị ảnh hưởng."
        confirmText="Xóa"
        variant="destructive"
        onConfirm={() => { setConfirmClear(false); clearHistory(); }}
      />
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const writes = message.actions?.filter((a) => a.write) ?? [];
  const reads = message.actions?.filter((a) => !a.write) ?? [];
  const imageCount = message.attachments?.length ?? 0;

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {writes.length > 0 && (
        <div className="space-y-1 w-full">
          {writes.map((a, i) => (
            <div key={i} className={cn(
              "flex items-start gap-1.5 text-xs rounded-md px-2 py-1 border",
              a.ok ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
            )}>
              {a.ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" /> : <XCircle className="h-3.5 w-3.5 mt-px shrink-0" />}
              <span>{a.summary}</span>
            </div>
          ))}
        </div>
      )}
      {reads.length > 0 && writes.length === 0 && (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Eye className="h-3 w-3" /> Đã tra cứu {reads.length} lần
        </span>
      )}
      {(message.content || imageCount > 0) && (
        <div className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
          {message.content}
          {imageCount > 0 && <span className={cn("block text-xs opacity-75", message.content && "mt-1")}>📎 {imageCount} ảnh</span>}
        </div>
      )}
    </div>
  );
}
