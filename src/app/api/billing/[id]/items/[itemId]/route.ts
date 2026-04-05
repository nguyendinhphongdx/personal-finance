import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    await requireAuth();
    const { itemId } = await params;
    const body = await req.json();

    // Check if period is locked
    const item = await prisma.billingItem.findUnique({
      where: { id: itemId },
      include: { billingPeriod: true },
    });

    if (!item) return error("Không tìm thấy hóa đơn phòng", 404);
    if (item.billingPeriod.isLocked) return error("Kỳ hóa đơn đã khóa, không thể chỉnh sửa", 403);

    // Update fees
    if (body.fees) {
      await prisma.billingItemFee.deleteMany({ where: { billingItemId: itemId } });

      const feeData = body.fees.map((f: { feeName: string; calcMode: string; unitPrice: number; quantity: number }) => ({
        billingItemId: itemId,
        feeName: f.feeName,
        calcMode: f.calcMode,
        unitPrice: f.unitPrice,
        quantity: f.quantity,
        amount: f.unitPrice * f.quantity,
      }));

      await prisma.billingItemFee.createMany({ data: feeData });

      const totalFees = feeData.reduce((s: number, f: { amount: number }) => s + f.amount, 0);
      const totalAmount = item.snapshotPrice + totalFees;

      const updated = await prisma.billingItem.update({
        where: { id: itemId },
        data: { totalAmount },
        include: { fees: true },
      });

      return success(updated);
    }

    // Toggle paid
    if (body.isPaid !== undefined) {
      const updated = await prisma.billingItem.update({
        where: { id: itemId },
        data: { isPaid: body.isPaid, paidAt: body.isPaid ? new Date() : null },
        include: { fees: true },
      });
      return success(updated);
    }

    return error("Không có dữ liệu cập nhật");
  } catch (err) {
    return handleApiError(err);
  }
}
