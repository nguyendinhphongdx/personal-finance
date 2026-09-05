import { prisma } from "@/lib/prisma";

export const roomRepo = {
  findMany: (userId: string) => {
    return prisma.room.findMany({
      where: { userId },
      include: {
        assignments: { where: { moveOutDate: null }, include: { tenant: true }, orderBy: { moveInDate: "asc" } },
        contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    });
  },

  findById: (id: string) => {
    return prisma.room.findUnique({
      where: { id },
      include: {
        assignments: { include: { tenant: true }, orderBy: { moveInDate: "asc" } },
        contracts: { orderBy: { createdAt: "desc" } },
      },
    });
  },

  create: (data: { name: string; floor: number; price: number; propertyId: string; userId: string }) => {
    return prisma.room.create({ data });
  },

  update: (id: string, data: { name?: string; floor?: number; price?: number; isActive?: boolean }) => {
    return prisma.room.update({ where: { id }, data });
  },

  delete: (id: string) => {
    return prisma.room.delete({ where: { id } });
  },
};

export const tenantRepo = {
  findMany: (userId: string, propertyId?: string) => {
    return prisma.tenant.findMany({
      where: { userId, ...(propertyId && { propertyId }) },
      include: {
        assignments: {
          where: { moveOutDate: null },
          include: { room: { include: { property: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  create: (data: { name: string; phone?: string; idNumber?: string; isFamily: boolean; propertyId: string; userId: string }) => {
    return prisma.tenant.create({ data, include: { assignments: true } });
  },

  update: (id: string, data: { name?: string; phone?: string; idNumber?: string; isFamily?: boolean }) => {
    return prisma.tenant.update({ where: { id }, data, include: { assignments: true } });
  },

  delete: (id: string) => {
    return prisma.tenant.delete({ where: { id } });
  },
};

export const roomAssignmentRepo = {
  setRoomTenants: async (roomId: string, tenantIds: string[], userId: string, moveInDate: Date) => {
    const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });

    if (tenantIds.length > 0) {
      const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } } });
      if (tenants.some((t) => t.propertyId !== room.propertyId)) {
        throw new Error("Người thuê không thuộc tài sản này");
      }
    }

    return prisma.$transaction(async (tx) => {
      const active = await tx.roomAssignment.findMany({ where: { roomId, moveOutDate: null } });

      const toMoveOut = active.filter((a) => !tenantIds.includes(a.tenantId));
      if (toMoveOut.length > 0) {
        await tx.roomAssignment.updateMany({
          where: { id: { in: toMoveOut.map((a) => a.id) } },
          data: { moveOutDate: new Date() },
        });
      }

      const activeTenantIds = new Set(active.map((a) => a.tenantId));
      const toAssign = tenantIds.filter((id) => !activeTenantIds.has(id));

      for (const tenantId of toAssign) {
        // End any active assignment this tenant has elsewhere before reassigning
        await tx.roomAssignment.updateMany({
          where: { tenantId, moveOutDate: null },
          data: { moveOutDate: new Date() },
        });
        await tx.roomAssignment.create({
          data: { tenantId, roomId, moveInDate, userId },
        });
      }

      return tx.roomAssignment.findMany({
        where: { roomId, moveOutDate: null },
        include: { tenant: true },
      });
    });
  },

  moveOut: (id: string) => {
    return prisma.roomAssignment.update({ where: { id }, data: { moveOutDate: new Date() } });
  },

  delete: (id: string) => {
    return prisma.roomAssignment.delete({ where: { id } });
  },
};

export const contractRepo = {
  findMany: (userId: string) => {
    return prisma.contract.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { createdAt: "desc" },
    });
  },

  create: (data: { roomId: string; startDate: Date; endDate?: Date; fileUrl: string; fileName: string; userId: string }) => {
    return prisma.contract.create({ data, include: { room: true } });
  },

  delete: (id: string) => {
    return prisma.contract.delete({ where: { id } });
  },
};

export const feeTypeRepo = {
  findMany: (propertyId: string) => {
    return prisma.feeType.findMany({
      where: { propertyId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  create: (data: { name: string; unit?: string; calcMode: "PER_UNIT" | "PER_PERSON" | "FIXED"; defaultPrice: number; sortOrder?: number; propertyId: string; userId: string }) => {
    return prisma.feeType.create({ data });
  },

  update: (id: string, data: { name?: string; unit?: string; calcMode?: "PER_UNIT" | "PER_PERSON" | "FIXED"; defaultPrice?: number; sortOrder?: number; isActive?: boolean }) => {
    return prisma.feeType.update({ where: { id }, data });
  },

  delete: (id: string) => {
    return prisma.feeType.update({ where: { id }, data: { isActive: false } });
  },
};
