"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { Settings, Bot, User, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

const AI_PROVIDERS = [
  {
    id: "google",
    name: "Google AI",
    description: "Gemini models - có free tier",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tag: "Nhanh, rẻ" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", tag: "Rẻ nhất" },
      { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash", tag: "Mới nhất" },
    ],
    keyPlaceholder: "AIza...",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", tag: "Rẻ, nhanh" },
      { id: "gpt-4o", name: "GPT-4o", tag: "Chính xác" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", tag: "Rẻ nhất" },
    ],
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models",
    models: [
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", tag: "Rẻ, nhanh" },
      { id: "claude-sonnet-4-6-20250514", name: "Claude Sonnet 4.6", tag: "Chính xác" },
    ],
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    aiProvider: "",
    aiModel: "",
    aiApiKey: "",
  });
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setSettings({
            aiProvider: data.data.aiProvider || "",
            aiModel: data.data.aiModel || "",
            aiApiKey: data.data.aiApiKey || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === settings.aiProvider);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      toast.success("Đã lưu cài đặt AI");
      const data = await res.json();
      if (data.data) {
        setSettings({
          aiProvider: data.data.aiProvider || "",
          aiModel: data.data.aiModel || "",
          aiApiKey: data.data.aiApiKey || "",
        });
      }
    } else {
      toast.error("Lưu thất bại");
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    // Auto save before testing
    const saveRes = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!saveRes.ok) {
      toast.error("Lưu cấu hình thất bại");
      setTesting(false);
      return;
    }

    // Test connection only
    const res = await fetch("/api/ai/test", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.success) {
      setTestResult("success");
      toast.success("Kết nối AI thành công!");
    } else {
      setTestResult("error");
      toast.error(data.error || "Kết nối thất bại");
    }
    setTesting(false);
  }

  async function handleClearAI() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiProvider: null, aiModel: null, aiApiKey: null }),
    });
    setSettings({ aiProvider: "", aiModel: "", aiApiKey: "" });
    setTestResult(null);
    toast.success("Đã xóa cấu hình AI");
    setSaving(false);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6" />
        Cài đặt
      </h1>

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai" className="cursor-pointer"><Bot className="h-4 w-4 mr-1" /> AI</TabsTrigger>
          <TabsTrigger value="account" className="cursor-pointer"><User className="h-4 w-4 mr-1" /> Tài khoản</TabsTrigger>
        </TabsList>

        {/* ===== TAB: AI ===== */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Cấu hình AI
                <InfoTooltip content="Kết nối AI để tự động phân tích voice input chính xác hơn. Nếu không cấu hình, hệ thống sẽ dùng parser cơ bản." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              {settings.aiProvider ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Đang sử dụng <strong>{selectedProvider?.name}</strong></span>
                  {testResult === "success" && <Badge className="bg-green-500">Hoạt động</Badge>}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Chưa cấu hình AI. Hệ thống đang dùng parser cơ bản.</span>
                </div>
              )}

              {/* Provider selection */}
              <div className="space-y-2">
                <Label>Provider <InfoTooltip content="Chọn nhà cung cấp AI. Google AI có free tier, phù hợp dùng thử." /></Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSettings({ ...settings, aiProvider: p.id, aiModel: p.models[0].id, aiApiKey: settings.aiProvider === p.id ? settings.aiApiKey : "" })}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        settings.aiProvider === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {settings.aiProvider && selectedProvider && (
                <>
                  {/* Model */}
                  <div className="space-y-2">
                    <Label>Model <InfoTooltip content="Model rẻ hơn thường đủ cho việc parse giao dịch đơn giản" /></Label>
                    <Select value={settings.aiModel} onValueChange={(v) => v && setSettings({ ...settings, aiModel: v })}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue>{selectedProvider.models.find((m) => m.id === settings.aiModel)?.name || "Chọn model"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProvider.models.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="cursor-pointer">
                            <div className="flex items-center gap-2">
                              {m.name}
                              <Badge variant="secondary" className="text-[10px]">{m.tag}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      API Key
                      <InfoTooltip content="API key được lưu mã hóa trên server. Chỉ bạn mới dùng được." />
                    </Label>
                    <Input
                      type="password"
                      value={settings.aiApiKey}
                      onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
                      placeholder={selectedProvider.keyPlaceholder}
                    />
                    <a
                      href={selectedProvider.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Lấy API key tại đây
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Lưu
                    </Button>
                    <Button variant="outline" onClick={handleTest} disabled={testing || !settings.aiApiKey} className="cursor-pointer">
                      {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Test thử
                      <InfoTooltip content='Gửi "ăn phở 50 nghìn" để test kết nối' />
                    </Button>
                    {settings.aiProvider && (
                      <Button variant="ghost" onClick={handleClearAI} className="cursor-pointer text-destructive hover:text-destructive">
                        Xóa cấu hình
                      </Button>
                    )}
                  </div>

                  {testResult === "error" && (
                    <p className="text-sm text-red-500">Kiểm tra lại API key và thử lại.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: Account ===== */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin tài khoản</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Các tùy chọn tài khoản sẽ được bổ sung trong phiên bản tiếp theo.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
