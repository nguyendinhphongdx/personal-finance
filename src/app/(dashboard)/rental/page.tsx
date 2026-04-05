"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import {
  Building2, Home, DoorOpen, Users, TrendingUp, TrendingDown,
  Receipt, Loader2, ArrowRight, ArrowUpRight, ArrowDownRight,
  Wallet, CheckCircle2, AlertCircle, Lock,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface DashboardData {
  overview: {
    totalProperties: number;
    totalRooms: number;
    occupiedRooms: number;
    emptyRooms: number;
    occupancyRate: number;
    totalTenants: number;
    totalMonthlyRent: number;
  };
  currentMonth: {
    month: number;
    year: number;
    revenue: number;
    paid: number;
    unpaid: number;
    landlord: number;
    electric: number;
    profit: number;
  };
  comparison: {
    revenueDiff: number;
    profitDiff: number;
    prevRevenue: number;
    prevProfit: number;
  };
  trend: { month: string; revenue: number; paid: number; cost: number; profit: number }[];
  propertyStats: {
    id: string;
    name: string;
    address?: string;
    rooms: number;
    occupied: number;
    occupancyRate: number;
    tenants: number;
    revenue: number;
    paid: number;
    unpaidCount: number;
    landlord: number;
    profit: number;
    hasBilling: boolean;
    isLocked: boolean;
  }[];
}

function DiffBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isPositive ? "+" : ""}{formatCurrency(value)}{suffix}
    </span>
  );
}

export default function RentalOverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rental/dashboard")
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!data) {
    return <div className="text-center py-20 text-muted-foreground">Không thể tải dữ liệu</div>;
  }

  const { overview, currentMonth, comparison, trend, propertyStats } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Tổng quan cho thuê
        <InfoTooltip content="Tổng hợp thông tin và hiệu suất tất cả nhà cho thuê" />
      </h1>

      {/* Row 1: Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4" /> Nhà cho thuê
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overview.totalProperties}</p>
            <p className="text-xs text-muted-foreground">{overview.totalRooms} phòng · {overview.totalTenants} người</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DoorOpen className="h-4 w-4" /> Lấp đầy
              <InfoTooltip content="Tỉ lệ phòng đang có người thuê" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {overview.occupancyRate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {overview.occupiedRooms}/{overview.totalRooms} phòng
              {overview.emptyRooms > 0 && <span className="text-amber-500"> · {overview.emptyRooms} trống</span>}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Receipt className="h-4 w-4" /> Doanh thu tháng {currentMonth.month}
              <InfoTooltip content="Tổng tiền phải thu từ tất cả phòng tháng này" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{formatCurrency(currentMonth.revenue)}</p>
            <DiffBadge value={comparison.revenueDiff} suffix=" vs T trước" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Wallet className="h-4 w-4" /> Lợi nhuận tháng {currentMonth.month}
              <InfoTooltip content="Đã thu - Tiền gửi chủ - Điện thực tế" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${currentMonth.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(currentMonth.profit)}
            </p>
            <DiffBadge value={comparison.profitDiff} suffix=" vs T trước" />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Current month detail + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current month breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Chi tiết tháng {currentMonth.month}/{currentMonth.year}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tổng phải thu</span>
                <span className="font-medium">{formatCurrency(currentMonth.revenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Đã thu</span>
                <span className="font-medium text-green-600">{formatCurrency(currentMonth.paid)}</span>
              </div>
              {currentMonth.unpaid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="h-3.5 w-3.5" /> Chưa thu</span>
                  <span className="font-medium text-amber-500">{formatCurrency(currentMonth.unpaid)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tiền gửi chủ nhà</span>
                <span className="font-medium text-red-500">-{formatCurrency(currentMonth.landlord)}</span>
              </div>
              {currentMonth.electric > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Điện thực tế</span>
                  <span className="font-medium text-red-500">-{formatCurrency(currentMonth.electric)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Lợi nhuận</span>
                <span className={`font-bold text-lg ${currentMonth.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatCurrency(currentMonth.profit)}
                </span>
              </div>
            </div>
            {/* Collection rate */}
            {currentMonth.revenue > 0 && (
              <div className="pt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Tiến độ thu tiền</span>
                  <span>{Math.round((currentMonth.paid / currentMonth.revenue) * 100)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (currentMonth.paid / currentMonth.revenue) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Xu hướng doanh thu & lợi nhuận</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={(v) => { const [, m] = v.split("-"); return `T${parseInt(m)}`; }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(v) => { const [y, m] = v.split("-"); return `Tháng ${parseInt(m)}/${y}`; }} />
                  <Legend />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Chi phí" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Lợi nhuận" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Per-property cards */}
      {propertyStats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Chưa có nhà nào.</p>
            <Link href="/rental/properties" className="text-primary hover:underline cursor-pointer">
              Thêm nhà cho thuê
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Hiệu suất theo nhà</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {propertyStats.map((p) => (
              <Link key={p.id} href={`/rental/properties/${p.id}`} className="block cursor-pointer">
                <Card className="transition-all duration-200 hover:shadow-lg hover:border-primary/30 h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Home className="h-5 w-5 text-primary" />
                        {p.name}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        {p.isLocked && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Room & tenant stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{p.occupied}<span className="text-xs text-muted-foreground font-normal">/{p.rooms}</span></p>
                        <p className="text-xs text-muted-foreground">Phòng</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{p.tenants}</p>
                        <p className="text-xs text-muted-foreground">Người ở</p>
                      </div>
                      <div>
                        <Badge variant={p.occupancyRate >= 80 ? "default" : p.occupancyRate >= 50 ? "secondary" : "destructive"} className="text-sm px-2 py-0.5">
                          {p.occupancyRate}%
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">Lấp đầy</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Financial stats */}
                    {p.hasBilling ? (
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Doanh thu</span>
                          <span className="font-medium">{formatCurrency(p.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gửi chủ</span>
                          <span className="text-red-500">-{formatCurrency(p.landlord)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Lợi nhuận</span>
                          <span className={p.profit >= 0 ? "text-green-500" : "text-red-500"}>
                            {formatCurrency(p.profit)}
                          </span>
                        </div>
                        {p.unpaidCount > 0 && (
                          <div className="flex items-center gap-1 text-amber-500 text-xs pt-1">
                            <AlertCircle className="h-3 w-3" />
                            {p.unpaidCount} phòng chưa thu tiền
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Chưa tạo hóa đơn tháng {currentMonth.month}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
