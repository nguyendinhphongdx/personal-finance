import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { getUserId } from "@/lib/request-context";

export const billingRepo = {
  findByPeriod: (propertyId: string, month: number, year: number) => {
    return prisma.billingPeriod.findFirst({
      where: { month, year, propertyId, userId: getUserId() },
      include: {
        items: {
          include: { fees: true, room: true },
          orderBy: [{ snapshotFloor: "asc" }, { snapshotRoomName: "asc" }],
        },
      },
    });
  },

  findMany: () => {
    return prisma.billingPeriod.findMany({
      where: { userId: getUserId() },
      include: { items: { include: { fees: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  },

  createPeriod: (data: { month: number; year: number; propertyId: string }) => {
    return prisma.billingPeriod.create({
      data: { ...data, userId: getUserId() },
      include: { items: { include: { fees: true } } },
    });
  },

  updatePeriod: async (
    id: string,
    data: {
      actualElectricBill?: number;
      landlordPayment?: number;
      totalCollected?: number;
      notes?: string;
      isLocked?: boolean;
      lockedAt?: Date | null;
    }
  ) => {
    const existing = await prisma.billingPeriod.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy kỳ hóa đơn");
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
    const period = await prisma.billingPeriod.findFirst({ where: { id: billingPeriodId, userId: getUserId() } });
    if (!period) throw new NotFoundError("Không tìm thấy kỳ hóa đơn");

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

  togglePaid: async (itemId: string, isPaid: boolean) => {
    const existing = await prisma.billingItem.findFirst({
      where: { id: itemId, billingPeriod: { userId: getUserId() } },
    });
    if (!existing) throw new NotFoundError("Không tìm thấy hóa đơn phòng");
    return prisma.billingItem.update({
      where: { id: itemId },
      data: { isPaid, paidAt: isPaid ? new Date() : null },
    });
  },

  deletePeriod: async (id: string) => {
    const existing = await prisma.billingPeriod.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy kỳ hóa đơn");
    return prisma.billingPeriod.delete({ where: { id } });
  },
};
