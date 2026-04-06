"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatCurrency, formatDate, formatMonthYear, CALC_MODE_LABELS, CALC_MODE_TOOLTIPS } from "@/lib/format";
import {
  Home, DoorOpen, Users, Plus, Edit2, Trash2, Loader2, MapPin,
  UserCheck, UserX, SlidersHorizontal, Receipt, ChevronLeft, ChevronRight,
  Lock, Unlock, CheckCircle2, Circle, ArrowLeft, Printer, Share2, TrendingUp, FileText,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface MetadataField { label: string; value: string }
interface Property {
  id: string; name: string; address?: string; numFloors: number;
  monthlyRent?: number; landlordName?: string; landlordPhone?: string; notes?: string;
  metadata?: MetadataField[];
}
interface Room {
  id: string; name: string; floor: number; price: number; isActive: boolean; propertyId: string;
  tenants: Tenant[];
}
interface Tenant {
  id: string; name: string; phone?: string; idNumber?: string; isFamily: boolean;
  moveInDate: string; moveOutDate?: string; roomId: string; room?: { name: string };
}
interface FeeType {
  id: string; name: string; unit?: string; calcMode: string; defaultPrice: number;
  isActive: boolean; sortOrder: number; propertyId: string;
}
interface BillingPeriod {
  id: string; month: number; year: number; isLocked: boolean;
  actualElectricBill?: number; landlordPayment?: number; totalCollected?: number; notes?: string;
  items: BillingItem[];
}
interface BillingItem {
  id: string; snapshotRoomName: string; snapshotFloor: number; snapshotPrice: number;
  snapshotTenants: { name: string; isFamily: boolean }[]; snapshotNumPeople: number;
  fees: { id: string; feeName: string; calcMode: string; unitPrice: number; quantity: number; amount: number }[];
  totalAmount: number; isPaid: boolean;
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = params.id as string;

  // Read state from URL
  const tabFromUrl = searchParams.get("tab") || "rooms";
  const monthFromUrl = parseInt(searchParams.get("month") ?? "") || (new Date().getMonth() + 1);
  const yearFromUrl = parseInt(searchParams.get("year") ?? "") || new Date().getFullYear();

  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [billing, setBilling] = useState<BillingPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  // Billing month state
  const [month, setMonth] = useState(monthFromUrl);
  const [year, setYear] = useState(yearFromUrl);

  // Sync state to URL
  function updateUrl(newTab?: string, newMonth?: number, newYear?: number) {
    const t = newTab ?? activeTab;
    const m = newMonth ?? month;
    const y = newYear ?? year;
    const params = new URLSearchParams();
    params.set("tab", t);
    if (t === "billing") {
      params.set("month", m.toString());
      params.set("year", y.toString());
    }
    router.replace(`/rental/properties/${propertyId}?${params.toString()}`, { scroll: false });
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    updateUrl(tab);
  }

  function handleMonthChange(newMonth: number, newYear: number) {
    setMonth(newMonth);
    setYear(newYear);
    updateUrl(undefined, newMonth, newYear);
  }

  // Dialog states
  const [roomDialog, setRoomDialog] = useState(false);
  const [tenantDialog, setTenantDialog] = useState(false);
  const [feeDialog, setFeeDialog] = useState(false);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [editFeeId, setEditFeeId] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string;
    confirmText?: string; variant?: "default" | "destructive";
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  function showConfirm(opts: Omit<typeof confirmState, "open">) {
    setConfirmState({ ...opts, open: true });
  }

  // Forms
  const [roomForm, setRoomForm] = useState({ name: "", floor: "", price: "" });
  const [tenantForm, setTenantForm] = useState({ name: "", phone: "", idNumber: "", isFamily: false, moveInDate: new Date().toISOString().split("T")[0], roomId: "" });
  const [feeForm, setFeeForm] = useState({ name: "", unit: "", calcMode: "FIXED", defaultPrice: "", sortOrder: "0" });
  const [summaryForm, setSummaryForm] = useState({ actualElectricBill: "", landlordPayment: "", notes: "" });
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProperty = useCallback(async () => {
    const res = await fetch(`/api/properties`);
    const data = await res.json();
    if (data.success) {
      const p = data.data.find((x: Property) => x.id === propertyId);
      if (p) setProperty(p);
    }
  }, [propertyId]);

  const loadRooms = useCallback(async () => {
    const res = await fetch(`/api/rooms?propertyId=${propertyId}`);
    const data = await res.json();
    if (data.success) setRooms(data.data);
  }, [propertyId]);

  const loadTenants = useCallback(async () => {
    const res = await fetch(`/api/tenants?propertyId=${propertyId}`);
    const data = await res.json();
    if (data.success) setTenants(data.data);
  }, [propertyId]);

  const loadFeeTypes = useCallback(async () => {
    const res = await fetch(`/api/fee-types?propertyId=${propertyId}`);
    const data = await res.json();
    if (data.success) setFeeTypes(data.data);
  }, [propertyId]);

  const loadBilling = useCallback(async () => {
    const res = await fetch(`/api/billing?propertyId=${propertyId}&month=${month}&year=${year}`);
    const data = await res.json();
    if (data.success) setBilling(data.data);
    else setBilling(null);
  }, [propertyId, month, year]);

  useEffect(() => {
    Promise.all([loadProperty(), loadRooms(), loadTenants(), loadFeeTypes(), loadBilling()])
      .finally(() => setLoading(false));
  }, [loadProperty, loadRooms, loadTenants, loadFeeTypes, loadBilling]);

  useEffect(() => {
    if (billing) {
      setSummaryForm({
        actualElectricBill: billing.actualElectricBill?.toString() || "",
        landlordPayment: billing.landlordPayment?.toString() || "",
        notes: billing.notes || "",
      });
    }
  }, [billing]);

  // ==================== ROOMS ====================
  async function handleRoomSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editRoomId ? `/api/rooms/${editRoomId}` : "/api/rooms";
      const method = editRoomId ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomForm.name, floor: parseInt(roomForm.floor), price: parseFloat(roomForm.price), propertyId }),
      });
      if (res.ok) {
        toast.success(editRoomId ? "Cập nhật phòng thành công" : "Thêm phòng thành công");
        setRoomDialog(false); setRoomForm({ name: "", floor: "", price: "" }); setEditRoomId(null);
        loadRooms();
      } else { const d = await res.json(); toast.error(d.error); }
    } finally { setSubmitting(false); }
  }

  function handleDeleteRoom(id: string) {
    showConfirm({
      title: "Xóa phòng?",
      description: "Xóa phòng sẽ xóa cả người thuê và hợp đồng liên quan. Hành động này không thể hoàn tác.",
      confirmText: "Xóa phòng",
      variant: "destructive",
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await fetch(`/api/rooms/${id}`, { method: "DELETE" });
          toast.success("Đã xóa"); loadRooms(); loadTenants();
        } finally { setSubmitting(false); }
      },
    });
  }

  // ==================== TENANTS ====================
  async function handleTenantSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantForm),
      });
      if (res.ok) {
        toast.success("Thêm người thuê thành công");
        setTenantDialog(false);
        setTenantForm({ name: "", phone: "", idNumber: "", isFamily: false, moveInDate: new Date().toISOString().split("T")[0], roomId: "" });
        loadRooms(); loadTenants();
      } else { const d = await res.json(); toast.error(d.error); }
    } finally { setSubmitting(false); }
  }

  function handleMoveOut(id: string) {
    showConfirm({
      title: "Xác nhận trả phòng?",
      description: "Người thuê sẽ được đánh dấu đã trả phòng với ngày hôm nay.",
      confirmText: "Xác nhận",
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await fetch(`/api/tenants/${id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moveOutDate: new Date().toISOString() }),
          });
          toast.success("Đã cập nhật"); loadRooms(); loadTenants();
        } finally { setSubmitting(false); }
      },
    });
  }

  function handleDeleteTenant(id: string) {
    showConfirm({
      title: "Xóa người thuê?",
      description: "Xóa vĩnh viễn thông tin người thuê này.",
      confirmText: "Xóa",
      variant: "destructive",
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await fetch(`/api/tenants/${id}`, { method: "DELETE" });
          toast.success("Đã xóa"); loadRooms(); loadTenants();
        } finally { setSubmitting(false); }
      },
    });
  }

  // ==================== FEE TYPES ====================
  async function handleFeeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editFeeId ? `/api/fee-types/${editFeeId}` : "/api/fee-types";
      const method = editFeeId ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: feeForm.name, unit: feeForm.unit || null, calcMode: feeForm.calcMode, defaultPrice: parseFloat(feeForm.defaultPrice), sortOrder: parseInt(feeForm.sortOrder), propertyId }),
      });
      if (res.ok) {
        toast.success(editFeeId ? "Cập nhật thành công" : "Thêm loại phí thành công");
        setFeeDialog(false); setFeeForm({ name: "", unit: "", calcMode: "FIXED", defaultPrice: "", sortOrder: "0" }); setEditFeeId(null);
        loadFeeTypes();
      } else { const d = await res.json(); toast.error(d.error); }
    } finally { setSubmitting(false); }
  }

  function handleDeleteFee(id: string) {
    showConfirm({
      title: "Xóa loại phí?",
      description: "Loại phí sẽ không còn áp dụng cho hóa đơn mới.",
      confirmText: "Xóa",
      variant: "destructive",
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await fetch(`/api/fee-types/${id}`, { method: "DELETE" });
          toast.success("Đã xóa"); loadFeeTypes();
        } finally { setSubmitting(false); }
      },
    });
  }

  // ==================== BILLING ====================
  async function createBilling() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, propertyId }),
      });
      if (res.ok) { toast.success("Tạo hóa đơn thành công"); loadBilling(); }
      else { const d = await res.json(); toast.error(d.error); }
    } finally { setSubmitting(false); }
  }

  function handleToggleLock() {
    if (!billing) return;
    const action = billing.isLocked ? "unlock" : "lock";

    if (action === "lock") {
      showConfirm({
        title: "Chốt sổ tháng này?",
        description: "Sau khi chốt, dữ liệu hóa đơn sẽ được khóa và không thể chỉnh sửa. Bạn vẫn có thể mở khóa sau nếu cần.",
        confirmText: "Chốt sổ",
        onConfirm: async () => {
          setSubmitting(true);
          try {
            await fetch(`/api/billing/${billing.id}`, {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "lock" }),
            });
            toast.success("Đã chốt sổ"); loadBilling();
          } finally { setSubmitting(false); }
        },
      });
    } else {
      showConfirm({
        title: "Mở khóa?",
        description: "Mở khóa để chỉnh sửa hóa đơn tháng này.",
        confirmText: "Mở khóa",
        onConfirm: async () => {
          setSubmitting(true);
          try {
            await fetch(`/api/billing/${billing.id}`, {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "unlock" }),
            });
            toast.success("Đã mở khóa"); loadBilling();
          } finally { setSubmitting(false); }
        },
      });
    }
  }

  async function handleTogglePaid(itemId: string, isPaid: boolean) {
    setSubmitting(true);
    try {
      await fetch(`/api/billing/${billing!.id}/items/${itemId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid }),
      });
      loadBilling();
    } finally { setSubmitting(false); }
  }

  async function handleUpdateFees(itemId: string, fees: { feeName: string; calcMode: string; unitPrice: number; quantity: number }[]) {
    if (billing?.isLocked) { toast.error("Kỳ hóa đơn đã khóa"); return; }
    setSubmitting(true);
    try {
      await fetch(`/api/billing/${billing!.id}/items/${itemId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fees }),
      });
      loadBilling();
    } finally { setSubmitting(false); }
  }

  async function handleSaveSummary() {
    if (!billing) return;
    setSubmitting(true);
    try {
      await fetch(`/api/billing/${billing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualElectricBill: summaryForm.actualElectricBill ? parseFloat(summaryForm.actualElectricBill) : null,
          landlordPayment: summaryForm.landlordPayment ? parseFloat(summaryForm.landlordPayment) : null,
          notes: summaryForm.notes || null,
        }),
      });
      toast.success("Lưu thành công"); loadBilling();
    } finally { setSubmitting(false); }
  }

  // Group rooms by floor
  const floors = new Map<number, Room[]>();
  rooms.forEach((r) => { const list = floors.get(r.floor) || []; list.push(r); floors.set(r.floor, list); });
  const sortedFloors = Array.from(floors.entries()).sort(([a], [b]) => a - b);

  // Billing calcs
  const totalFromRooms = billing?.items.reduce((s, i) => s + i.totalAmount, 0) ?? 0;
  const totalPaid = billing?.items.filter((i) => i.isPaid).reduce((s, i) => s + i.totalAmount, 0) ?? 0;
  const totalUnpaid = totalFromRooms - totalPaid;
  const paidCount = billing?.items.filter((i) => i.isPaid).length ?? 0;
  const unpaidCount = (billing?.items.length ?? 0) - paidCount;
  const landlordPay = summaryForm.landlordPayment ? parseFloat(summaryForm.landlordPayment) : (billing?.landlordPayment ?? property?.monthlyRent ?? 0);
  const electricBill = summaryForm.actualElectricBill ? parseFloat(summaryForm.actualElectricBill) : (billing?.actualElectricBill ?? 0);
  const electricFromRooms = billing?.items.reduce((s, i) => s + (i.fees.find((f) => f.calcMode === "PER_UNIT")?.amount ?? 0), 0) ?? 0;
  const electricProfit = electricFromRooms - electricBill;
  const profit = totalPaid - landlordPay - electricBill;
  const totalRoomPrice = billing?.items.reduce((s, i) => s + i.snapshotPrice, 0) ?? 0;
  const totalFees = totalFromRooms - totalRoomPrice;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!property) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy nhà</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/rental" className="cursor-pointer"><ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" /></Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" /> {property.name}
          </h1>
          {property.address && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{property.address}</p>}
        </div>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => v && handleTabChange(v)}>
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="rooms" className="cursor-pointer"><DoorOpen className="h-4 w-4 mr-1" /> Phòng & Người ở</TabsTrigger>
          <TabsTrigger value="billing" className="cursor-pointer"><Receipt className="h-4 w-4 mr-1" /> Hóa đơn</TabsTrigger>
          <TabsTrigger value="fees" className="cursor-pointer"><SlidersHorizontal className="h-4 w-4 mr-1" /> Loại phí</TabsTrigger>
          <TabsTrigger value="info" className="cursor-pointer"><FileText className="h-4 w-4 mr-1" /> Thông tin</TabsTrigger>
        </TabsList>

        {/* ===== TAB: PHÒNG & NGƯỜI Ở ===== */}
        <TabsContent value="rooms" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rooms.length} phòng, {rooms.reduce((s, r) => s + r.tenants.length, 0)} người ở</p>
            <div className="flex gap-2">
              <Dialog open={tenantDialog} onOpenChange={(o) => { setTenantDialog(o); if (!o) setTenantForm({ name: "", phone: "", idNumber: "", isFamily: false, moveInDate: new Date().toISOString().split("T")[0], roomId: "" }); }}>
                <DialogTrigger>
                  <Button variant="outline" className="cursor-pointer"><Users className="h-4 w-4 mr-2" /> Thêm người</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Thêm người thuê</DialogTitle></DialogHeader>
                  <form onSubmit={handleTenantSubmit} className="space-y-4">
                    <div className="space-y-2"><Label>Họ tên</Label><Input value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>SĐT</Label><Input value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} /></div>
                      <div className="space-y-2"><Label>CCCD</Label><Input value={tenantForm.idNumber} onChange={(e) => setTenantForm({ ...tenantForm, idNumber: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Phòng</Label>
                      <Select value={tenantForm.roomId} onValueChange={(v) => setTenantForm({ ...tenantForm, roomId: v ?? "" })}>
                        <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                        <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id} className="cursor-pointer">{r.name} - Tầng {r.floor}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Ngày vào</Label><Input type="date" value={tenantForm.moveInDate} onChange={(e) => setTenantForm({ ...tenantForm, moveInDate: e.target.value })} required /></div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isFamily" checked={tenantForm.isFamily} onChange={(e) => setTenantForm({ ...tenantForm, isFamily: e.target.checked })} className="cursor-pointer" />
                      <Label htmlFor="isFamily" className="cursor-pointer">Người nhà <InfoTooltip content="VD: em gái, người thân" /></Label>
                    </div>
                    <Button type="submit" className="w-full cursor-pointer" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Thêm</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={roomDialog} onOpenChange={(o) => { setRoomDialog(o); if (!o) { setEditRoomId(null); setRoomForm({ name: "", floor: "", price: "" }); } }}>
                <DialogTrigger>
                  <Button className="cursor-pointer"><Plus className="h-4 w-4 mr-2" /> Thêm phòng</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editRoomId ? "Sửa phòng" : "Thêm phòng"}</DialogTitle></DialogHeader>
                  <form onSubmit={handleRoomSubmit} className="space-y-4">
                    <div className="space-y-2"><Label>Tên phòng</Label><Input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="Phòng 201" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Tầng</Label><Input type="number" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} min={1} required /></div>
                      <div className="space-y-2"><Label>Giá phòng (VND)</Label><CurrencyInput value={roomForm.price} onValueChange={(v) => setRoomForm({ ...roomForm, price: v })} placeholder="2.500.000" required /></div>
                    </div>
                    <Button type="submit" className="w-full cursor-pointer" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editRoomId ? "Cập nhật" : "Thêm"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {sortedFloors.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Chưa có phòng. Thêm phòng để bắt đầu!</CardContent></Card>
          ) : sortedFloors.map(([floor, floorRooms]) => (
            <div key={floor} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tầng {floor}</h3>
              <div className="space-y-2">
                {floorRooms.map((room) => (
                  <Card key={room.id} className="transition-all duration-200 hover:shadow-md">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        {/* Room info + Price */}
                        <div className="flex items-center gap-2">
                          <DoorOpen className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold">{room.name}</span>
                          <span className="text-sm text-muted-foreground">{formatCurrency(room.price)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => { setRoomForm({ name: room.name, floor: room.floor.toString(), price: room.price.toString() }); setEditRoomId(room.id); setRoomDialog(true); }}><Edit2 className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer text-destructive" onClick={() => handleDeleteRoom(room.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>

                      {/* Tenants */}
                      <div className="flex items-center gap-2 flex-wrap mt-2 pl-6">
                        {room.tenants.length > 0 ? room.tenants.map((t) => (
                          <div key={t.id} className="flex items-center gap-1 bg-muted/50 rounded-full px-2.5 py-0.5 text-sm">
                            <span>{t.name}</span>
                            {t.isFamily && <Badge variant="default" className="text-[10px] px-1 py-0 h-4">GĐ</Badge>}
                            <Button variant="ghost" size="icon" className="h-5 w-5 cursor-pointer" onClick={() => handleMoveOut(t.id)} title="Trả phòng"><UserX className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 cursor-pointer text-destructive" onClick={() => handleDeleteTenant(t.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )) : (
                          <span className="text-xs text-muted-foreground italic">Trống</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>


        {/* ===== TAB: HÓA ĐƠN ===== */}
        <TabsContent value="billing" className="space-y-4">
          {/* Month nav + Lock */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="cursor-pointer" onClick={() => { const m = month === 1 ? 12 : month - 1; const y = month === 1 ? year - 1 : year; handleMonthChange(m, y); }}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="font-semibold min-w-36 text-center">{formatMonthYear(month, year)}</span>
              <Button variant="outline" size="icon" className="cursor-pointer" onClick={() => { const m = month === 12 ? 1 : month + 1; const y = month === 12 ? year + 1 : year; handleMonthChange(m, y); }}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            {billing && (
              <div className="flex items-center gap-2">
                {billing.isLocked ? (
                  <Badge variant="default" className="bg-amber-500 text-white"><Lock className="h-3 w-3 mr-1" /> Đã chốt sổ</Badge>
                ) : (
                  <Badge variant="secondary"><Unlock className="h-3 w-3 mr-1" /> Chưa chốt</Badge>
                )}
                <Button variant={billing.isLocked ? "outline" : "default"} size="sm" onClick={handleToggleLock} className="cursor-pointer" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : billing.isLocked ? <><Unlock className="h-4 w-4 mr-1" /> Mở khóa</> : <><Lock className="h-4 w-4 mr-1" /> Chốt sổ</>}
                </Button>
              </div>
            )}
          </div>

          {!billing ? (
            <Card><CardContent className="py-12 text-center space-y-4">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Chưa có hóa đơn cho {formatMonthYear(month, year)}</p>
              <Button onClick={createBilling} className="cursor-pointer" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Tạo hóa đơn <InfoTooltip content="Tự động tạo hóa đơn cho tất cả phòng đang có người ở" /></Button>
            </CardContent></Card>
          ) : billing.items.length === 0 ? (
            <Card><CardContent className="py-8 text-center space-y-3">
              <p className="text-muted-foreground">Chưa có hóa đơn phòng nào cho tháng này.</p>
              <p className="text-sm text-muted-foreground">Nếu đã thêm người thuê, bấm nút bên dưới để tạo hóa đơn.</p>
              <Button onClick={createBilling} className="cursor-pointer" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Tạo hóa đơn cho phòng có người ở</Button>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Số phòng</p>
                  <p className="text-lg font-bold">{billing.items.length}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Thanh toán</p>
                  <p className="text-lg font-bold"><span className="text-green-500">{paidCount} thu</span> · <span className="text-red-500">{unpaidCount} chưa</span></p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Tổng phải thu</p>
                  <p className="text-lg font-bold">{formatCurrency(totalFromRooms)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Còn thiếu</p>
                  <p className={`text-lg font-bold ${totalUnpaid > 0 ? "text-red-500" : "text-green-500"}`}>{formatCurrency(totalUnpaid)}</p>
                </Card>
              </div>

              {/* Room billing cards */}
              {billing.items.map((item) => (
                <BillingItemCard key={item.id} item={item} isLocked={billing.isLocked}
                  propertyName={property.name}
                  billingMonth={billing.month} billingYear={billing.year}
                  onTogglePaid={(isPaid) => handleTogglePaid(item.id, isPaid)}
                  onUpdateFees={(fees) => handleUpdateFees(item.id, fees)} />
              ))}

              {/* Summary */}
              <Card className="border-2 border-primary/20">
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Tổng kết tháng <InfoTooltip content="Lợi nhuận = Đã thu - Tiền chủ nhà - Điện thực tế" /></CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {/* Revenue breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">DOANH THU</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Tiền phòng ({billing.items.length} phòng)</span><span className="font-medium">{formatCurrency(totalRoomPrice)}</span></div>
                        <div className="flex justify-between"><span>Phí dịch vụ (điện, nước, mạng...)</span><span className="font-medium">{formatCurrency(totalFees)}</span></div>
                        <Separator />
                        <div className="flex justify-between font-semibold"><span>Tổng phải thu</span><span className="text-green-500">{formatCurrency(totalFromRooms)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Đã thu ({paidCount}/{billing.items.length} phòng)</span><span>{formatCurrency(totalPaid)}</span></div>
                        {totalUnpaid > 0 && <div className="flex justify-between text-red-500"><span>Chưa thu ({unpaidCount} phòng)</span><span>{formatCurrency(totalUnpaid)}</span></div>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">CHI PHÍ</p>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Tiền gửi chủ nhà <InfoTooltip content={`Mặc định: ${formatCurrency(property.monthlyRent ?? 0)}/tháng từ cấu hình nhà`} /></Label>
                          <CurrencyInput value={summaryForm.landlordPayment} onValueChange={(v) => setSummaryForm({ ...summaryForm, landlordPayment: v })}
                            placeholder={property.monthlyRent?.toLocaleString("vi-VN") ?? "0"} disabled={billing.isLocked} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Hóa đơn điện thực tế <InfoTooltip content={`Thu từ phòng: ${formatCurrency(electricFromRooms)}. Chênh lệch = lợi nhuận điện`} /></Label>
                          <CurrencyInput value={summaryForm.actualElectricBill} onValueChange={(v) => setSummaryForm({ ...summaryForm, actualElectricBill: v })}
                            disabled={billing.isLocked} />
                          {electricBill > 0 && (
                            <p className={`text-xs ${electricProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              Lời điện: {formatCurrency(electricProfit)} (thu {formatCurrency(electricFromRooms)} - thực tế {formatCurrency(electricBill)})
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Lợi nhuận tháng này</p>
                      <p className={`text-2xl font-bold ${profit >= 0 ? "text-green-500" : "text-red-500"}`}>{formatCurrency(profit)}</p>
                      <p className="text-xs text-muted-foreground mt-1">= Đã thu ({formatCurrency(totalPaid)}) - Chủ nhà ({formatCurrency(landlordPay)}) - Điện ({formatCurrency(electricBill)})</p>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Ghi chú</Label>
                        <Input value={summaryForm.notes} onChange={(e) => setSummaryForm({ ...summaryForm, notes: e.target.value })} placeholder="Ghi chú tháng này..." disabled={billing.isLocked} className="w-60" />
                      </div>
                      {!billing.isLocked && <Button onClick={handleSaveSummary} className="cursor-pointer w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Lưu tổng kết</Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB: LOẠI PHÍ ===== */}
        <TabsContent value="fees" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{feeTypes.length} loại phí <InfoTooltip content="Cấu hình phí riêng cho nhà này" /></p>
            <Dialog open={feeDialog} onOpenChange={(o) => { setFeeDialog(o); if (!o) { setEditFeeId(null); setFeeForm({ name: "", unit: "", calcMode: "FIXED", defaultPrice: "", sortOrder: "0" }); } }}>
              <DialogTrigger>
                <Button className="cursor-pointer"><Plus className="h-4 w-4 mr-2" /> Thêm loại phí</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editFeeId ? "Sửa loại phí" : "Thêm loại phí"}</DialogTitle></DialogHeader>
                <form onSubmit={handleFeeSubmit} className="space-y-4">
                  <div className="space-y-2"><Label>Tên <InfoTooltip content="VD: Tiền điện, Phí gửi xe..." /></Label><Input value={feeForm.name} onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })} required /></div>
                  <div className="space-y-2">
                    <Label>Cách tính <InfoTooltip content="Theo SL: nhập số × đơn giá. Theo người: số người × đơn giá. Cố định: phí/phòng" /></Label>
                    <Select value={feeForm.calcMode} onValueChange={(v) => setFeeForm({ ...feeForm, calcMode: v ?? "FIXED" })}>
                      <SelectTrigger className="cursor-pointer"><SelectValue>{CALC_MODE_LABELS[feeForm.calcMode]}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PER_UNIT" className="cursor-pointer">Theo số lượng</SelectItem>
                        <SelectItem value="PER_PERSON" className="cursor-pointer">Theo người</SelectItem>
                        <SelectItem value="FIXED" className="cursor-pointer">Cố định</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Đơn giá</Label><CurrencyInput value={feeForm.defaultPrice} onValueChange={(v) => setFeeForm({ ...feeForm, defaultPrice: v })} placeholder="4.000" required /></div>
                    <div className="space-y-2"><Label>Đơn vị</Label><Input value={feeForm.unit} onChange={(e) => setFeeForm({ ...feeForm, unit: e.target.value })} placeholder="kWh" /></div>
                  </div>
                  <Button type="submit" className="w-full cursor-pointer" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editFeeId ? "Cập nhật" : "Thêm"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {feeTypes.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Chưa có loại phí</CardContent></Card>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tên phí</TableHead><TableHead>Cách tính</TableHead><TableHead className="text-right">Đơn giá</TableHead><TableHead>Đơn vị</TableHead><TableHead className="w-20"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {feeTypes.map((ft) => (
                  <TableRow key={ft.id}>
                    <TableCell className="font-medium">{ft.name}</TableCell>
                    <TableCell><Badge variant="outline">{CALC_MODE_LABELS[ft.calcMode]} <InfoTooltip content={CALC_MODE_TOOLTIPS[ft.calcMode]} /></Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(ft.defaultPrice)}</TableCell>
                    <TableCell className="text-muted-foreground">{ft.unit || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => { setFeeForm({ name: ft.name, unit: ft.unit || "", calcMode: ft.calcMode, defaultPrice: ft.defaultPrice.toString(), sortOrder: ft.sortOrder.toString() }); setEditFeeId(ft.id); setFeeDialog(true); }}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer text-destructive" onClick={() => handleDeleteFee(ft.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ===== TAB: THÔNG TIN ===== */}
        <TabsContent value="info" className="space-y-4">
          <PropertyInfoTab property={property} onSaved={loadProperty} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== PROPERTY INFO TAB ====================
function PropertyInfoTab({ property, onSaved }: { property: Property; onSaved: () => void }) {
  const [metadata, setMetadata] = useState<MetadataField[]>(
    (property.metadata as MetadataField[]) || []
  );
  const [saving, setSaving] = useState(false);
  const [editInfo, setEditInfo] = useState({
    landlordName: property.landlordName || "",
    landlordPhone: property.landlordPhone || "",
    notes: property.notes || "",
  });

  function addField() {
    setMetadata([...metadata, { label: "", value: "" }]);
  }

  function updateField(idx: number, key: "label" | "value", val: string) {
    const updated = [...metadata];
    updated[idx] = { ...updated[idx], [key]: val };
    setMetadata(updated);
  }

  function removeField(idx: number) {
    setMetadata(metadata.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    const cleanMeta = metadata.filter((m) => m.label.trim() || m.value.trim());
    const res = await fetch(`/api/properties/${property.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        landlordName: editInfo.landlordName || null,
        landlordPhone: editInfo.landlordPhone || null,
        notes: editInfo.notes || null,
        metadata: cleanMeta.length > 0 ? cleanMeta : null,
      }),
    });
    if (res.ok) {
      toast.success("Đã lưu thông tin");
      onSaved();
    } else {
      toast.error("Lưu thất bại");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin chủ nhà</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tên chủ nhà</Label>
              <Input value={editInfo.landlordName} onChange={(e) => setEditInfo({ ...editInfo, landlordName: e.target.value })} placeholder="Nguyễn Văn B" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">SĐT chủ nhà</Label>
              <Input value={editInfo.landlordPhone} onChange={(e) => setEditInfo({ ...editInfo, landlordPhone: e.target.value })} placeholder="0901234567" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ghi chú chung</Label>
            <Input value={editInfo.notes} onChange={(e) => setEditInfo({ ...editInfo, notes: e.target.value })} placeholder="VD: hợp đồng ký ngày..." />
          </div>
        </CardContent>
      </Card>

      {/* Custom fields */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Thông tin bổ sung
              <InfoTooltip content="Thêm thông tin tùy ý: SĐT nhà mạng, số hợp đồng, mã khách hàng điện..." />
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addField} className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" /> Thêm mục
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {metadata.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có thông tin bổ sung. Bấm &quot;Thêm mục&quot; để thêm.
            </p>
          ) : (
            metadata.map((field, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={field.label}
                  onChange={(e) => updateField(idx, "label", e.target.value)}
                  placeholder="Tiêu đề (VD: SĐT nhà mạng)"
                  className="w-40 md:w-52 text-sm"
                />
                <Input
                  value={field.value}
                  onChange={(e) => updateField(idx, "value", e.target.value)}
                  placeholder="Giá trị"
                  className="flex-1 text-sm"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-destructive shrink-0" onClick={() => removeField(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Lưu thông tin
      </Button>
    </div>
  );
}

// ==================== BILLING ITEM CARD ====================
function BillingItemCard({ item, isLocked, propertyName, billingMonth, billingYear, onTogglePaid, onUpdateFees }: {
  item: BillingItem; isLocked: boolean;
  propertyName: string; billingMonth: number; billingYear: number;
  onTogglePaid: (isPaid: boolean) => void;
  onUpdateFees: (fees: { feeName: string; calcMode: string; unitPrice: number; quantity: number }[]) => void;
}) {
  const feesKey = JSON.stringify(item.fees);
  const [localFees, setLocalFees] = useState(() => item.fees.map((f) => ({ ...f })));
  const [prevFeesKey, setPrevFeesKey] = useState(feesKey);
  const [expanded, setExpanded] = useState(false);
  if (feesKey !== prevFeesKey) {
    setPrevFeesKey(feesKey);
    setLocalFees(item.fees.map((f) => ({ ...f })));
  }

  function handleQtyChange(idx: number, val: string) {
    const updated = [...localFees];
    updated[idx] = { ...updated[idx], quantity: parseFloat(val) || 0 };
    updated[idx].amount = updated[idx].unitPrice * updated[idx].quantity;
    setLocalFees(updated);
  }

  const localTotal = item.snapshotPrice + localFees.reduce((s, f) => s + f.amount, 0);
  const hasChanges = JSON.stringify(localFees.map((f) => f.quantity)) !== JSON.stringify(item.fees.map((f) => f.quantity));

  return (
    <Card className={`transition-all duration-200 ${item.isPaid ? "border-green-500/30 bg-green-500/5" : ""}`}>
      {/* Compact header - always visible */}
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DoorOpen className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{item.snapshotRoomName}</CardTitle>
            <Badge variant="outline" className="text-xs">T{item.snapshotFloor}</Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">{item.snapshotTenants.map((t) => t.name).join(", ")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">{formatCurrency(localTotal)}</span>
            <Button variant={item.isPaid ? "default" : "outline"} size="sm"
              className={`cursor-pointer ${item.isPaid ? "bg-green-500 hover:bg-green-600" : ""}`}
              onClick={(e) => { e.stopPropagation(); onTogglePaid(!item.isPaid); }} disabled={isLocked}>
              {item.isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expandable detail - for screenshot / sharing */}
      {expanded && (
        <CardContent className="space-y-3 border-t pt-4" id={`bill-${item.id}`}>
          {/* Bill header for screenshot */}
          <div className="text-center pb-2">
            <p className="font-bold text-lg">{propertyName}</p>
            <p className="text-sm text-muted-foreground">{formatMonthYear(billingMonth, billingYear)}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Phòng:</span><span className="font-medium">{item.snapshotRoomName} (Tầng {item.snapshotFloor})</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Người ở:</span><span>{item.snapshotTenants.map((t) => t.name + (t.isFamily ? " (GĐ)" : "")).join(", ")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Số người:</span><span>{item.snapshotNumPeople}</span></div>
          </div>

          <Separator />

          {/* Fee breakdown table */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm py-1">
              <span>Tiền phòng</span>
              <span className="font-medium">{formatCurrency(item.snapshotPrice)}</span>
            </div>

            {localFees.map((fee, idx) => (
              <div key={fee.id || idx} className="flex items-center justify-between text-sm py-1 border-t border-dashed">
                <div className="flex items-center gap-2">
                  <span>{fee.feeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {fee.calcMode === "PER_UNIT" ? (
                    <>
                      <Input type="number" className="w-16 h-7 text-right text-sm" value={fee.quantity || ""}
                        onChange={(e) => handleQtyChange(idx, e.target.value)} disabled={isLocked} placeholder="0" />
                      <span className="text-muted-foreground text-xs">{fee.unitPrice > 0 ? `× ${formatCurrency(fee.unitPrice)}` : ""}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {fee.quantity} {fee.calcMode === "PER_PERSON" ? "người" : ""} × {formatCurrency(fee.unitPrice)}
                    </span>
                  )}
                  <span className="font-medium min-w-22.5 text-right">{formatCurrency(fee.calcMode === "PER_UNIT" ? fee.unitPrice * (localFees[idx]?.quantity || 0) : fee.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          <Separator className="border-2" />

          {/* Total */}
          <div className="flex justify-between items-center py-1">
            <span className="font-bold text-base">TỔNG CỘNG</span>
            <span className="font-bold text-xl">{formatCurrency(localTotal)}</span>
          </div>

          {/* Status */}
          <div className="flex justify-between items-center pt-2 border-t">
            <div className="flex items-center gap-2">
              {item.isPaid ? (
                <Badge className="bg-green-500 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Đã thanh toán</Badge>
              ) : (
                <Badge variant="destructive"><Circle className="h-3 w-3 mr-1" /> Chưa thanh toán</Badge>
              )}
            </div>
            {hasChanges && !isLocked && (
              <Button size="sm" onClick={() => onUpdateFees(localFees.map((f) => ({ feeName: f.feeName, calcMode: f.calcMode, unitPrice: f.unitPrice, quantity: f.quantity })))} className="cursor-pointer">Lưu thay đổi</Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
