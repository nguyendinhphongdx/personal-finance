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
import { Settings, Bot, User, Loader2, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AI_PROVIDERS, type AIModelOption } from "@/lib/ai-models";


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
  // Live model list from the provider's API (null = not loaded, fall back to suggestions)
  const [liveModels, setLiveModels] = useState<AIModelOption[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  async function loadModels(provider: string, apiKey: string) {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json();
      if (data.success) setLiveModels(data.data);
      else { setLiveModels(null); toast.error(data.error || "Không tải được danh sách model"); }
    } finally {
      setLoadingModels(false);
    }
  }

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
          if (data.data.aiProvider && data.data.aiApiKey) loadModels(data.data.aiProvider, data.data.aiApiKey);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === settings.aiProvider);

  // Live list (tagged with our suggestions) when available, else the suggestions.
  // Always keep the saved model visible so the select never shows blank.
  const modelOptions: AIModelOption[] = (() => {
    if (!selectedProvider) return [];
    const tags = new Map(selectedProvider.suggested.map((m) => [m.id, m.tag]));
    const base = liveModels
      ? liveModels.map((m) => ({ ...m, tag: tags.get(m.id) }))
      : selectedProvider.suggested;
    if (settings.aiModel && !base.some((m) => m.id === settings.aiModel)) {
      return [{ id: settings.aiModel, name: settings.aiModel, tag: liveModels ? "Không còn hỗ trợ" : undefined }, ...base];
    }
    return base;
  })();
  const modelUnavailable = !!liveModels && !!settings.aiModel && !liveModels.some((m) => m.id === settings.aiModel);

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
                      onClick={() => {
                        if (p.id === settings.aiProvider) return;
                        setSettings({ ...settings, aiProvider: p.id, aiModel: p.defaultModel, aiApiKey: "" });
                        setLiveModels(null);
                        setTestResult(null);
                      }}
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
                    <div className="flex items-center justify-between">
                      <Label>Model <InfoTooltip content="Model rẻ hơn thường đủ cho việc parse giao dịch đơn giản" /></Label>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs cursor-pointer"
                        onClick={() => loadModels(settings.aiProvider, settings.aiApiKey)}
                        disabled={loadingModels || !settings.aiApiKey}
                        title={settings.aiApiKey ? "Lấy danh sách model mới nhất từ provider" : "Nhập API key trước"}>
                        {loadingModels ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        {liveModels ? "Tải lại danh sách" : "Tải danh sách model"}
                      </Button>
                    </div>
                    <Select value={settings.aiModel} onValueChange={(v) => v && setSettings({ ...settings, aiModel: v })}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue>{modelOptions.find((m) => m.id === settings.aiModel)?.name || "Chọn model"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {modelOptions.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="cursor-pointer">
                            <div className="flex items-center gap-2">
                              {m.name}
                              {m.tag && <Badge variant={m.tag === "Không còn hỗ trợ" ? "destructive" : "secondary"} className="text-[10px]">{m.tag}</Badge>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {modelUnavailable && (
                      <p className="text-xs text-red-500">Model đang chọn không còn trong danh sách của {selectedProvider.name}. Hãy chọn model khác rồi bấm Lưu.</p>
                    )}
                    {liveModels && <p className="text-xs text-muted-foreground">{liveModels.length} model khả dụng với API key này</p>}
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
