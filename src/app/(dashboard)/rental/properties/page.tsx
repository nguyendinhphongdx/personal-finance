"use client";

import { useEffect, useState } from "react";
import { useRentalStore } from "@/stores/rental.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatCurrency } from "@/lib/format";
import { Plus, Edit2, Trash2, Home, MapPin, Building2, DoorOpen, Users, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export default function PropertiesPage() {
  const { properties, fetchProperties } = useRentalStore();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", numFloors: "1", monthlyRent: "",
    landlordName: "", landlordPhone: "", notes: "",
  });

  useEffect(() => {
    fetchProperties().then(() => setLoading(false));
  }, [fetchProperties]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editId ? `/api/properties/${editId}` : "/api/properties";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address || null,
        numFloors: parseInt(form.numFloors) || 1,
        monthlyRent: form.monthlyRent ? parseFloat(form.monthlyRent) : null,
        landlordName: form.landlordName || null,
        landlordPhone: form.landlordPhone || null,
        notes: form.notes || null,
      }),
    });
    if (res.ok) {
      toast.success(editId ? "Cập nhật thành công" : "Thêm nhà thành công");
      setDialogOpen(false);
      resetForm();
      fetchProperties();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa nhà sẽ ẩn toàn bộ phòng, người thuê và hóa đơn liên quan. Bạn chắc chứ?")) return;
    const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Đã xóa"); fetchProperties(); }
  }

  function resetForm() {
    setForm({ name: "", address: "", numFloors: "1", monthlyRent: "", landlordName: "", landlordPhone: "", notes: "" });
    setEditId(null);
  }

  function startEdit(p: typeof properties[0]) {
    setForm({
      name: p.name,
      address: p.address || "",
      numFloors: p.numFloors.toString(),
      monthlyRent: p.monthlyRent?.toString() || "",
      landlordName: p.landlordName || "",
      landlordPhone: p.landlordPhone || "",
      notes: p.notes || "",
    });
    setEditId(p.id);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nhà cho thuê <InfoTooltip content="Quản lý các nhà/bất động sản cho thuê. Mỗi nhà có phòng, loại phí và hóa đơn riêng." /></h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger>
            <Button className="cursor-pointer"><Plus className="h-4 w-4 mr-2" /> Thêm nhà</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Sửa thông tin nhà" : "Thêm nhà mới"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tên nhà <InfoTooltip content="VD: Nhà Quận 7, Nhà Bình Thạnh..." /></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nhà Quận 7" required />
              </div>
              <div className="space-y-2">
                <Label>Địa chỉ</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Nguyễn Văn Linh, Q7" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số tầng</Label>
                  <Input type="number" value={form.numFloors} onChange={(e) => setForm({ ...form, numFloors: e.target.value })} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Tiền thuê gửi chủ /tháng <InfoTooltip content="Số tiền bạn phải gửi cho chủ nhà hàng tháng" /></Label>
                  <CurrencyInput value={form.monthlyRent} onValueChange={(v) => setForm({ ...form, monthlyRent: v })} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên chủ nhà</Label>
                  <Input value={form.landlordName} onChange={(e) => setForm({ ...form, landlordName: e.target.value })} placeholder="Nguyễn Văn B" />
                </div>
                <div className="space-y-2">
                  <Label>SĐT chủ nhà</Label>
                  <Input value={form.landlordPhone} onChange={(e) => setForm({ ...form, landlordPhone: e.target.value })} placeholder="0901234567" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ghi chú thêm..." rows={2} />
              </div>
              <Button type="submit" className="w-full cursor-pointer">{editId ? "Cập nhật" : "Thêm nhà"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Chưa có nhà nào. Thêm nhà để bắt đầu quản lý!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => {
            const totalRooms = p.rooms?.length || 0;
            const totalTenants = p.rooms?.reduce((s, r) => s + (r.tenants?.length || 0), 0) || 0;
            return (
              <Card key={p.id} className="transition-all duration-200 hover:shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-primary" />
                      {p.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => startEdit(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" /> {p.address}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="text-center">
                      <p className="text-lg font-bold">{p.numFloors}</p>
                      <p className="text-xs text-muted-foreground">Tầng</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold flex items-center justify-center gap-1"><DoorOpen className="h-4 w-4" />{totalRooms}</p>
                      <p className="text-xs text-muted-foreground">Phòng</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold flex items-center justify-center gap-1"><Users className="h-4 w-4" />{totalTenants}</p>
                      <p className="text-xs text-muted-foreground">Người ở</p>
                    </div>
                  </div>
                  {p.monthlyRent && (
                    <div className="flex items-center justify-between pt-2 border-t text-sm">
                      <span className="text-muted-foreground">Tiền gửi chủ:</span>
                      <span className="font-semibold">{formatCurrency(p.monthlyRent)}/tháng</span>
                    </div>
                  )}
                  {p.landlordName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Chủ nhà:</span>
                      <span>{p.landlordName} {p.landlordPhone && `(${p.landlordPhone})`}</span>
                    </div>
                  )}
                  <Link href={`/rental/properties/${p.id}`} className="flex items-center justify-center gap-2 pt-3 border-t text-sm text-primary hover:underline cursor-pointer">
                    Xem chi tiết <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
