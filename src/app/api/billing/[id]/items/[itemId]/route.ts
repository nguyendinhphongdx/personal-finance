import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";

const CALC_MODES = ["PER_UNIT", "PER_PERSON", "FIXED"] as const;
type CalcMode = (typeof CALC_MODES)[number];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    return await withUserContext(async (userId) => {
      const { itemId } = await params;
      const body = await req.json();

      // Check ownership and whether period is locked
      const item = await prisma.billingItem.findUnique({
        where: { id: itemId },
        include: { billingPeriod: true },
      });

      if (!item || item.billingPeriod.userId !== userId) return error("Không tìm thấy hóa đơn phòng", 404);
      if (item.billingPeriod.isLocked) return error("Kỳ hóa đơn đã khóa, không thể chỉnh sửa", 403);

      // Replace the whole fee list (fees from FeeTypes + ad-hoc extras added for this month)
      if (body.fees) {
        if (!Array.isArray(body.fees)) return error("Danh sách phí không hợp lệ");

        const feeData: { billingItemId: string; feeName: string; calcMode: CalcMode; unitPrice: number; quantity: number; amount: number; isExtra: boolean }[] = [];
        for (const f of body.fees as { feeName?: unknown; calcMode?: unknown; unitPrice?: unknown; quantity?: unknown; isExtra?: unknown }[]) {
          const feeName = typeof f.feeName === "string" ? f.feeName.trim() : "";
          const unitPrice = Number(f.unitPrice);
          const quantity = Number(f.quantity);
          if (!feeName) return error("Tên khoản phí không được để trống");
          if (!CALC_MODES.includes(f.calcMode as CalcMode)) return error("Cách tính không hợp lệ");
          if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity) || quantity < 0) return error("Số tiền không hợp lệ");
          feeData.push({
            billingItemId: itemId,
            feeName,
            calcMode: f.calcMode as CalcMode,
            unitPrice,
            quantity,
            amount: unitPrice * quantity,
            isExtra: f.isExtra === true,
          });
        }

        const totalAmount = item.snapshotPrice + feeData.reduce((s, f) => s + f.amount, 0);

        const updated = await prisma.$transaction(async (tx) => {
          await tx.billingItemFee.deleteMany({ where: { billingItemId: itemId } });
          await tx.billingItemFee.createMany({ data: feeData });
          return tx.billingItem.update({
            where: { id: itemId },
            data: { totalAmount },
            include: { fees: true },
          });
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
    });
  } catch (err) {
    return handleApiError(err);
  }
}
