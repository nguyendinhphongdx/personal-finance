import { prisma } from "@/lib/prisma";

export const roomRepo = {
  findMany: (userId: string) => {
    return prisma.room.findMany({
      where: { userId },
      include: {
        tenants: { where: { moveOutDate: null }, orderBy: { moveInDate: "asc" } },
        contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    });
  },

  findById: (id: string) => {
    return prisma.room.findUnique({
      where: { id },
      include: {
        tenants: { orderBy: { moveInDate: "asc" } },
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
  findMany: (userId: string) => {
    return prisma.tenant.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { moveInDate: "desc" },
    });
  },

  create: (data: { name: string; phone?: string; idNumber?: string; isFamily: boolean; moveInDate: Date; roomId: string; userId: string }) => {
    return prisma.tenant.create({ data, include: { room: true } });
  },

  update: (id: string, data: { name?: string; phone?: string; idNumber?: string; isFamily?: boolean; moveOutDate?: Date | null }) => {
    return prisma.tenant.update({ where: { id }, data, include: { room: true } });
  },

  delete: (id: string) => {
    return prisma.tenant.delete({ where: { id } });
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
