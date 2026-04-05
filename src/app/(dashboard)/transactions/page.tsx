"use client";

import { useEffect, useState, useCallback } from "react";
import { useTransactionStore } from "@/stores/transaction.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { CategoryCombobox } from "@/components/shared/category-combobox";
import { useUIStore } from "@/stores/ui.store";
import { VoiceInput } from "@/components/shared/voice-input";
import { Numpad } from "@/components/shared/numpad";
import { useIsMobile } from "@/hooks/use-mobile";
import { parseVoiceInput, matchCategory } from "@/lib/voice-parser";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

const CHART_COLORS = ["#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6b7280", "#3b82f6"];

export default function TransactionsPage() {
  const { transactions, categories, loading, fetchTransactions, fetchCategories } = useTransactionStore();
  const { transactionDialogOpen, setTransactionDialogOpen } = useUIStore();
  const [dialogOpen, setDialogOpenLocal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [numpadOpen, setNumpadOpen] = useState(false);
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ amount: "", type: "EXPENSE" as string, description: "", date: new Date().toISOString().split("T")[0], categoryId: "" });

  // Sync global store → local dialog
  useEffect(() => {
    if (transactionDialogOpen) {
      setDialogOpenLocal(true);
      setTransactionDialogOpen(false);
    }
  }, [transactionDialogOpen, setTransactionDialogOpen]);

  function setDialogOpen(open: boolean) {
    setDialogOpenLocal(open);
    if (!open) resetForm();
  }

  const loadData = useCallback(() => {
    fetchTransactions(filterType !== "all" ? { type: filterType } : undefined);
    fetchCategories();
  }, [fetchTransactions, fetchCategories, filterType]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredCategories = categories.filter((c) => c.type === form.type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editId ? `/api/transactions/${editId}` : "/api/transactions";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });

    if (res.ok) {
      toast.success(editId ? "Cập nhật thành công" : "Thêm thành công");
      setDialogOpen(false);
      resetForm();
      loadData();
    } else {
      const data = await res.json();
      toast.error(data.error || "Có lỗi xảy ra");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Xóa thành công");
      loadData();
    }
  }

  function resetForm() {
    setForm({ amount: "", type: "EXPENSE", description: "", date: new Date().toISOString().split("T")[0], categoryId: "" });
    setEditId(null);
  }

  function startEdit(tx: typeof transactions[0]) {
    setForm({
      amount: tx.amount.toString(),
      type: tx.type,
      description: tx.description || "",
      date: new Date(tx.date).toISOString().split("T")[0],
      categoryId: tx.categoryId,
    });
    setEditId(tx.id);
    setDialogOpen(true);
  }

  // Voice input handler - try AI first, fallback to local parser
  async function handleVoiceResult(text: string) {
    toast.info(`Đang xử lý: "${text}"`);

    // Try AI extraction first
    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        const ai = data.data;
        const newForm = { ...form };
        newForm.type = ai.type || "EXPENSE";
        if (ai.amount) newForm.amount = ai.amount.toString();
        if (ai.description) newForm.description = ai.description;
        if (ai.categoryHint) {
          const matchedId = matchCategory(ai.categoryHint, categories, newForm.type as "INCOME" | "EXPENSE");
          if (matchedId) newForm.categoryId = matchedId;
        }
        setForm(newForm);
        toast.success("AI đã phân tích thành công");
        return;
      }
    } catch {
      // AI failed, fallback to local
    }

    // Fallback: local parser
    const parsed = parseVoiceInput(text);
    const newForm = { ...form };
    newForm.type = parsed.type;
    if (parsed.amount) newForm.amount = parsed.amount.toString();
    if (parsed.description) newForm.description = parsed.description;

    if (parsed.categoryHint) {
      const matchedId = matchCategory(parsed.categoryHint, categories, parsed.type);
      if (matchedId) newForm.categoryId = matchedId;
    }

    setForm(newForm);
    toast.success("Đã nhận (parser cơ bản)");
  }

  // Stats
  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  // Chart data - by category
  const catMap = new Map<string, { name: string; total: number; color: string }>();
  transactions.filter((t) => t.type === "EXPENSE").forEach((t) => {
    const key = t.categoryId;
    const existing = catMap.get(key);
    if (existing) {
      existing.total += t.amount;
    } else {
      catMap.set(key, { name: t.category?.name || "Khác", total: t.amount, color: t.category?.color || "#6b7280" });
    }
  });
  const pieData = Array.from(catMap.values());

  // Monthly trend
  const monthMap = new Map<string, { income: number; expense: number }>();
  transactions.forEach((t) => {
    const key = new Date(t.date).toISOString().slice(0, 7);
    const existing = monthMap.get(key) || { income: 0, expense: 0 };
    if (t.type === "INCOME") existing.income += t.amount;
    else existing.expense += t.amount;
    monthMap.set(key, existing);
  });
  const trendData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thu chi</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button className="cursor-pointer"><Plus className="h-4 w-4 mr-2" /> Thêm giao dịch</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editId ? "Sửa giao dịch" : "Thêm giao dịch"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Voice input + Amount (hero) */}
              {!editId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <VoiceInput onResult={handleVoiceResult} />
                  <p className="text-xs text-muted-foreground">Nói: &quot;ăn phở 50 nghìn&quot;, &quot;đổ xăng 200k&quot;</p>
                </div>
              )}

              {/* Amount - big & prominent */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Số tiền</Label>
                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setNumpadOpen(true)}
                    className="w-full h-14 rounded-md border bg-background text-2xl font-bold text-center cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                  >
                    {form.amount ? <>{new Intl.NumberFormat("vi-VN").format(parseInt(form.amount))} <span className="text-sm text-muted-foreground font-normal">đ</span></> : <span className="text-muted-foreground">Nhấn để nhập</span>}
                  </button>
                ) : (
                  <CurrencyInput value={form.amount} onValueChange={(v) => setForm({ ...form, amount: v })} placeholder="0" required className="text-2xl font-bold h-14 text-center" />
                )}
              </div>

              {/* Type toggle + Category - inline */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Loại</Label>
                  <div className="flex rounded-lg border overflow-hidden">
                    <button type="button" onClick={() => setForm({ ...form, type: "EXPENSE", categoryId: "" })}
                      className={cn("flex-1 py-2 text-sm font-medium cursor-pointer transition-colors", form.type === "EXPENSE" ? "bg-red-500 text-white" : "hover:bg-muted")}>
                      Chi tiêu
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, type: "INCOME", categoryId: "" })}
                      className={cn("flex-1 py-2 text-sm font-medium cursor-pointer transition-colors", form.type === "INCOME" ? "bg-green-500 text-white" : "hover:bg-muted")}>
                      Thu nhập
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Ngày</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="h-10" />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Danh mục <InfoTooltip content="Chọn hoặc gõ tên mới để tạo" /></Label>
                <CategoryCombobox
                  categories={filteredCategories}
                  value={form.categoryId}
                  onChange={(id) => setForm({ ...form, categoryId: id })}
                  type={form.type as "INCOME" | "EXPENSE"}
                  onCategoryCreated={() => fetchCategories()}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ghi chú</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="VD: ăn trưa với đồng nghiệp" />
              </div>

              {/* Hidden input for form validation on mobile */}
              {isMobile && <input type="hidden" name="amount" value={form.amount} required />}

              <Button type="submit" className="w-full cursor-pointer h-11 text-base">{editId ? "Cập nhật" : "Thêm giao dịch"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Numpad overlay for mobile */}
      {numpadOpen && (
        <Numpad
          value={form.amount}
          onChange={(v) => setForm({ ...form, amount: v })}
          onDone={() => setNumpadOpen(false)}
          onCancel={() => setNumpadOpen(false)}
        />
      )}

      {/* Stats cards - compact */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="p-3 md:p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Thu nhập</p>
          <p className="text-base md:text-xl font-bold text-green-500 mt-1">{formatCurrency(totalIncome)}</p>
        </Card>
        <Card className="p-3 md:p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Chi tiêu</p>
          <p className="text-base md:text-xl font-bold text-red-500 mt-1">{formatCurrency(totalExpense)}</p>
        </Card>
        <Card className="p-3 md:p-4">
          <p className="text-xs text-muted-foreground">Còn lại</p>
          <p className={`text-base md:text-xl font-bold mt-1 ${totalIncome - totalExpense >= 0 ? "text-green-500" : "text-red-500"}`}>{formatCurrency(totalIncome - totalExpense)}</p>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trend">
        <TabsList>
          <TabsTrigger value="trend" className="cursor-pointer">Xu hướng <InfoTooltip content="Biểu đồ thu chi theo thời gian" /></TabsTrigger>
          <TabsTrigger value="category" className="cursor-pointer">Danh mục <InfoTooltip content="Tỉ lệ chi tiêu theo danh mục" /></TabsTrigger>
        </TabsList>
        <TabsContent value="trend">
          <Card>
            <CardContent className="pt-6">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                    <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend />
                    <Bar dataKey="income" name="Thu nhập" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Chi tiêu" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="category">
          <Card>
            <CardContent className="pt-6">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu chi tiêu</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Filter + Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Danh sách giao dịch</CardTitle>
            <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "all")}>
              <SelectTrigger className="w-40 cursor-pointer"><SelectValue>{{ all: "Tất cả", INCOME: "Thu nhập", EXPENSE: "Chi tiêu" }[filterType]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">Tất cả</SelectItem>
                <SelectItem value="INCOME" className="cursor-pointer">Thu nhập</SelectItem>
                <SelectItem value="EXPENSE" className="cursor-pointer">Chi tiêu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chưa có giao dịch nào</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" style={{ borderColor: tx.category?.color, color: tx.category?.color }}>
                        {tx.category?.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.description || "—"}</TableCell>
                    <TableCell className={`text-right font-medium ${tx.type === "INCOME" ? "text-green-500" : "text-red-500"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => startEdit(tx)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-destructive" onClick={() => handleDelete(tx.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
