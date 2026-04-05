import { prisma } from "@/lib/prisma";

export const billingRepo = {
  findByPeriod: (propertyId: string, month: number, year: number) => {
    return prisma.billingPeriod.findUnique({
      where: { month_year_propertyId: { month, year, propertyId } },
      include: {
        items: {
          include: { fees: true, room: true },
          orderBy: [{ snapshotFloor: "asc" }, { snapshotRoomName: "asc" }],
        },
      },
    });
  },

  findMany: (userId: string) => {
    return prisma.billingPeriod.findMany({
      where: { userId },
      include: { items: { include: { fees: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  },

  createPeriod: (data: { month: number; year: number; propertyId: string; userId: string }) => {
    return prisma.billingPeriod.create({
      data,
      include: { items: { include: { fees: true } } },
    });
  },

  updatePeriod: (
    id: string,
    data: {
      actualElectricBill?: number;
      landlordPayment?: number;
      totalCollected?: number;
      notes?: string;
      isLocked?: boolean;
      lockedAt?: Date;
    }
  ) => {
    return prisma.billingPeriod.update({
      where: { id },
      data,
      include: { items: { include: { fees: true } } },
    });
  },

  upsertItem: async (
    billingPeriodId: string,
    roomId: string,
    snapshot: {
      snapshotRoomName: string;
      snapshotFloor: number;
      snapshotPrice: number;
      snapshotTenants: { name: string; isFamily: boolean }[];
      snapshotNumPeople: number;
    },
    fees: { feeName: string; calcMode: "PER_UNIT" | "PER_PERSON" | "FIXED"; unitPrice: number; quantity: number; amount: number }[],
    totalAmount: number
  ) => {
    // Find existing item
    const existing = await prisma.billingItem.findFirst({
      where: { billingPeriodId, roomId },
    });

    if (existing) {
      // Delete old fees and update
      await prisma.billingItemFee.deleteMany({ where: { billingItemId: existing.id } });
      return prisma.billingItem.update({
        where: { id: existing.id },
        data: {
          ...snapshot,
          totalAmount,
          fees: { create: fees },
        },
        include: { fees: true },
      });
    }

    return prisma.billingItem.create({
      data: {
        billingPeriodId,
        roomId,
        ...snapshot,
        totalAmount,
        fees: { create: fees },
      },
      include: { fees: true },
    });
  },

  togglePaid: (itemId: string, isPaid: boolean) => {
    return prisma.billingItem.update({
      where: { id: itemId },
      data: { isPaid, paidAt: isPaid ? new Date() : null },
    });
  },

  deletePeriod: (id: string) => {
    return prisma.billingPeriod.delete({ where: { id } });
  },
};
