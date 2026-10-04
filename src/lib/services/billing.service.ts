import { prisma } from "@/lib/prisma";
import { billingRepo } from "@/lib/repositories/billing.repo";
import { assertOwnsProperty } from "@/lib/repositories/ownership";
import { BadRequestError } from "@/lib/errors";
import { getUserId } from "@/lib/request-context";

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
};
