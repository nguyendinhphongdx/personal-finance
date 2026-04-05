"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Wallet, Home, Loader2, ArrowLeftRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";

const CHART_COLORS = ["#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#06b6d4", "#ec4899", "#f97316", "#14b8a6"];

interface DashboardData {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  rentalProfit: number;
  rentalIncome: number;
  rentalCost: number;
  categoryBreakdown: { categoryId: string; category?: { name: string; color?: string }; type: string; total: number }[];
  recentTransactions: { id: string; amount: number; type: string; description?: string; date: string; category: { name: string; color?: string } }[];
  trend: { month: string; income: number; expense: number; net: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?period=${period}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!data) {
    return <div className="text-center py-20 text-muted-foreground">Không thể tải dữ liệu</div>;
  }

  const expenseByCategory = data.categoryBreakdown
    .filter((c) => c.type === "EXPENSE")
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tổng quan <InfoTooltip content="Báo cáo tổng hợp tài chính cá nhân và nhà cho thuê" /></h1>
        <Tabs value={period} onValueChange={(v) => v && setPeriod(v as typeof period)}>
          <TabsList>
            <TabsTrigger value="week" className="cursor-pointer">Tuần</TabsTrigger>
            <TabsTrigger value="month" className="cursor-pointer">Tháng</TabsTrigger>
            <TabsTrigger value="quarter" className="cursor-pointer">Quý</TabsTrigger>
            <TabsTrigger value="year" className="cursor-pointer">Năm</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Thu nhập <InfoTooltip content="Tổng thu nhập trong kỳ" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{formatCurrency(data.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-4 w-4" /> Chi tiêu <InfoTooltip content="Tổng chi tiêu trong kỳ" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(data.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Wallet className="h-4 w-4" /> Còn lại <InfoTooltip content="Thu nhập - Chi tiêu" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${data.netAmount >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(data.netAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Home className="h-4 w-4" /> Lợi nhuận nhà <InfoTooltip content="Tổng thu từ phòng - Tiền chủ nhà - Điện thực tế" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${data.rentalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(data.rentalProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Xu hướng 6 tháng <InfoTooltip content="Biểu đồ thu chi theo 6 tháng gần nhất" /></CardTitle>
          </CardHeader>
          <CardContent>
            {data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Thu nhập" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="expense" name="Chi tiêu" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="net" name="Còn lại" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
            )}
          </CardContent>
        </Card>

        {/* Expense by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chi tiêu theo danh mục <InfoTooltip content="Tỉ lệ chi tiêu theo từng danh mục" /></CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="total"
                    nameKey="category.name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {expenseByCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.category?.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Chưa có chi tiêu</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4" /> Giao dịch gần đây
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Chưa có giao dịch</p>
          ) : (
            <div className="space-y-2">
              {data.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" style={{ borderColor: tx.category?.color, color: tx.category?.color }}>
                      {tx.category?.name}
                    </Badge>
                    <div>
                      <p className="text-sm">{tx.description || tx.category?.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <span className={`font-medium ${tx.type === "INCOME" ? "text-green-500" : "text-red-500"}`}>
                    {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
