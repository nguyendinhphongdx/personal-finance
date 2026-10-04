import { prisma } from "@/lib/prisma";
import { billingRepo } from "@/lib/repositories/billing.repo";
import { assertOwnsProperty } from "@/lib/repositories/ownership";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { getUserId } from "@/lib/request-context";

const CALC_MODES = ["PER_UNIT", "PER_PERSON", "FIXED"] as const;
type CalcMode = (typeof CALC_MODES)[number];

export interface FeeInput {
  feeName: string;
  calcMode: string;
  unitPrice: number;
  quantity: number;
  isExtra?: boolean;
}

/** Load a billing item owned by the current user whose period is still editable. */
async function getEditableItem(itemId: string) {
  const item = await prisma.billingItem.findFirst({
    where: { id: itemId, billingPeriod: { userId: getUserId() } },
    include: { billingPeriod: true, fees: true },
  });
  if (!item) throw new NotFoundError("Không tìm thấy hóa đơn phòng");
  if (item.billingPeriod.isLocked) throw new BadRequestError("Kỳ hóa đơn đã khóa, không thể chỉnh sửa");
  return item;
}

const periodInclude = {
  items: {
    include: { fees: true, room: true },
    orderBy: [{ snapshotFloor: "asc" as const }, { snapshotRoomName: "asc" as const }],
  },
};

export const billingService = {
  /**
   * Create (or reuse) the billing period for a property/month and generate one
   * BillingItem per occupied room that doesn't have one yet. Existing items are
   * never overwritten. A FeeType restricted to specific rooms only applies to those rooms.
   */
  generatePeriod: async (propertyId: string, month: number, year: number) => {
    const userId = getUserId();
    await assertOwnsProperty(propertyId);

    let period = await prisma.billingPeriod.findFirst({ where: { month, year, propertyId, userId } });
    if (period?.isLocked) throw new BadRequestError("Kỳ hóa đơn đã khóa, không thể tạo thêm");
    if (!period) {
      period = await prisma.billingPeriod.create({ data: { month, year, propertyId, userId } });
    }

    const rooms = await prisma.room.findMany({
      where: { propertyId, userId, isActive: true },
      include: { assignments: { where: { moveOutDate: null }, include: { tenant: true } } },
    });

    const feeTypes = await prisma.feeType.findMany({
      where: { propertyId, userId, isActive: true },
      include: { rooms: { select: { roomId: true } } },
      orderBy: { sortOrder: "asc" },
    });

    for (const room of rooms) {
      if (room.assignments.length === 0) continue;

      const existing = await prisma.billingItem.findFirst({
        where: { billingPeriodId: period.id, roomId: room.id },
      });
      if (existing) continue; // Don't overwrite existing items

      const numPeople = room.assignments.length;
      const fees = feeTypes
        .filter((ft) => ft.rooms.length === 0 || ft.rooms.some((r) => r.roomId === room.id))
        .map((ft) => {
          let quantity = 1;
          if (ft.calcMode === "PER_PERSON") quantity = numPeople;
          if (ft.calcMode === "PER_UNIT") quantity = 0;
          return {
            feeName: ft.name,
            calcMode: ft.calcMode,
            unitPrice: ft.defaultPrice,
            quantity,
            amount: ft.calcMode === "PER_UNIT" ? 0 : quantity * ft.defaultPrice,
          };
        });

      const totalFees = fees.reduce((s, f) => s + f.amount, 0);

      await prisma.billingItem.create({
        data: {
          billingPeriodId: period.id,
          roomId: room.id,
          snapshotRoomName: room.name,
          snapshotFloor: room.floor,
          snapshotPrice: room.price,
          snapshotTenants: room.assignments.map((a) => ({ name: a.tenant.name, isFamily: a.tenant.isFamily })),
          snapshotNumPeople: numPeople,
          totalAmount: room.price + totalFees,
          fees: { create: fees },
        },
      });
    }

    return prisma.billingPeriod.findUnique({ where: { id: period.id }, include: periodInclude });
  },

  getPeriod: (propertyId: string, month: number, year: number) => {
    return billingRepo.findByPeriod(propertyId, month, year);
  },

  getAllPeriods: () => {
    return billingRepo.findMany();
  },

  updatePeriodSummary: (
    periodId: string,
    data: { actualElectricBill?: number; landlordPayment?: number; totalCollected?: number; notes?: string }
  ) => {
    return billingRepo.updatePeriod(periodId, data);
  },

  lockPeriod: (periodId: string) => {
    return billingRepo.updatePeriod(periodId, { isLocked: true, lockedAt: new Date() });
  },

  unlockPeriod: (periodId: string) => {
    return billingRepo.updatePeriod(periodId, { isLocked: false, lockedAt: null });
  },

  togglePaid: (itemId: string, isPaid: boolean) => {
    return billingRepo.togglePaid(itemId, isPaid);
  },

  deletePeriod: (periodId: string) => {
    return billingRepo.deletePeriod(periodId);
  },

  getEditableItem,

  /**
   * Replace the whole fee list of a room's bill (fees from FeeTypes + ad-hoc extras)
   * and recompute its total.
   */
  updateItemFees: async (itemId: string, fees: FeeInput[]) => {
    const item = await getEditableItem(itemId);

    const feeData = fees.map((f) => {
      const feeName = typeof f.feeName === "string" ? f.feeName.trim() : "";
      const unitPrice = Number(f.unitPrice);
      const quantity = Number(f.quantity);
      if (!feeName) throw new BadRequestError("Tên khoản phí không được để trống");
      if (!CALC_MODES.includes(f.calcMode as CalcMode)) throw new BadRequestError("Cách tính không hợp lệ");
      if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity) || quantity < 0) throw new BadRequestError("Số tiền không hợp lệ");
      return {
        billingItemId: itemId,
        feeName,
        calcMode: f.calcMode as CalcMode,
        unitPrice,
        quantity,
        amount: unitPrice * quantity,
        isExtra: f.isExtra === true,
      };
    });

    const totalAmount = item.snapshotPrice + feeData.reduce((s, f) => s + f.amount, 0);
    if (totalAmount < 0) throw new BadRequestError("Giảm trừ vượt quá tổng tiền phòng");

    return prisma.$transaction(async (tx) => {
      await tx.billingItemFee.deleteMany({ where: { billingItemId: itemId } });
      await tx.billingItemFee.createMany({ data: feeData });
      return tx.billingItem.update({
        where: { id: itemId },
        data: { totalAmount },
        include: { fees: true },
      });
    });
  },

  setItemPaid: async (itemId: string, isPaid: boolean) => {
    await getEditableItem(itemId);
    return prisma.billingItem.update({
      where: { id: itemId },
      data: { isPaid, paidAt: isPaid ? new Date() : null },
      include: { fees: true },
    });
  },
};
