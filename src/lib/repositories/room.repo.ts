import { prisma } from "@/lib/prisma";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { assertOwnsProperty, assertOwnsRoom } from "./ownership";
import { getUserId } from "@/lib/request-context";

export const roomRepo = {
  findMany: () => {
    return prisma.room.findMany({
      where: { userId: getUserId() },
      include: {
        assignments: { where: { moveOutDate: null }, include: { tenant: true }, orderBy: { moveInDate: "asc" } },
        contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    });
  },

  findById: (id: string) => {
    return prisma.room.findFirst({
      where: { id, userId: getUserId() },
      include: {
        assignments: { include: { tenant: true }, orderBy: { moveInDate: "asc" } },
        contracts: { orderBy: { createdAt: "desc" } },
      },
    });
  },

  create: async (data: { name: string; floor: number; price: number; propertyId: string }) => {
    await assertOwnsProperty(data.propertyId);
    return prisma.room.create({ data: { ...data, userId: getUserId() } });
  },

  update: async (id: string, data: { name?: string; floor?: number; price?: number; isActive?: boolean }) => {
    const existing = await prisma.room.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy phòng");
    return prisma.room.update({ where: { id }, data });
  },

  delete: async (id: string) => {
    const existing = await prisma.room.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy phòng");
    return prisma.room.delete({ where: { id } });
  },
};

export const tenantRepo = {
  findMany: (propertyId?: string) => {
    return prisma.tenant.findMany({
      where: { userId: getUserId(), ...(propertyId && { propertyId }) },
      include: {
        assignments: {
          where: { moveOutDate: null },
          include: { room: { include: { property: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  create: async (data: { name: string; phone?: string; idNumber?: string; isFamily: boolean; propertyId: string }) => {
    await assertOwnsProperty(data.propertyId);
    return prisma.tenant.create({ data: { ...data, userId: getUserId() }, include: { assignments: true } });
  },

  update: async (id: string, data: { name?: string; phone?: string; idNumber?: string; isFamily?: boolean }) => {
    const existing = await prisma.tenant.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy người thuê");
    return prisma.tenant.update({ where: { id }, data, include: { assignments: true } });
  },

  delete: async (id: string) => {
    const existing = await prisma.tenant.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy người thuê");
    return prisma.tenant.delete({ where: { id } });
  },
};

export const roomAssignmentRepo = {
  setRoomTenants: async (roomId: string, tenantIds: string[], moveInDate: Date) => {
    const userId = getUserId();
    const room = await prisma.room.findFirst({ where: { id: roomId, userId } });
    if (!room) throw new NotFoundError("Không tìm thấy phòng");

    if (tenantIds.length > 0) {
      const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds }, userId } });
      if (tenants.length !== tenantIds.length) {
        throw new NotFoundError("Không tìm thấy người thuê");
      }
      if (tenants.some((t) => t.propertyId !== room.propertyId)) {
        throw new BadRequestError("Người thuê không thuộc tài sản này");
      }
    }

    return prisma.$transaction(async (tx) => {
      const active = await tx.roomAssignment.findMany({ where: { roomId, userId, moveOutDate: null } });

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
          where: { tenantId, userId, moveOutDate: null },
          data: { moveOutDate: new Date() },
        });
        await tx.roomAssignment.create({
          data: { tenantId, roomId, moveInDate, userId },
        });
      }

      return tx.roomAssignment.findMany({
        where: { roomId, userId, moveOutDate: null },
        include: { tenant: true },
      });
    });
  },

  moveOut: async (id: string) => {
    const existing = await prisma.roomAssignment.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy bản ghi ở phòng");
    return prisma.roomAssignment.update({ where: { id }, data: { moveOutDate: new Date() } });
  },

  delete: async (id: string) => {
    const existing = await prisma.roomAssignment.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy bản ghi ở phòng");
    return prisma.roomAssignment.delete({ where: { id } });
  },
};

export const contractRepo = {
  findMany: () => {
    return prisma.contract.findMany({
      where: { userId: getUserId() },
      include: { room: true },
      orderBy: { createdAt: "desc" },
    });
  },

  create: async (data: { roomId: string; startDate: Date; endDate?: Date; fileUrl: string; fileName: string }) => {
    await assertOwnsRoom(data.roomId);
    return prisma.contract.create({ data: { ...data, userId: getUserId() }, include: { room: true } });
  },

  delete: async (id: string) => {
    const existing = await prisma.contract.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy hợp đồng");
    return prisma.contract.delete({ where: { id } });
  },
};

type CalcMode = "PER_UNIT" | "PER_PERSON" | "FIXED";

// roomIds must be rooms of the same property owned by the current user.
async function assertRoomsInProperty(propertyId: string, roomIds: string[]) {
  if (roomIds.length === 0) return;
  const count = await prisma.room.count({ where: { id: { in: roomIds }, propertyId, userId: getUserId() } });
  if (count !== new Set(roomIds).size) throw new BadRequestError("Phòng không thuộc nhà này");
}

const feeTypeInclude = { rooms: { select: { roomId: true } } } as const;

export const feeTypeRepo = {
  findMany: (propertyId: string) => {
    return prisma.feeType.findMany({
      where: { propertyId, userId: getUserId(), isActive: true },
      include: feeTypeInclude,
      orderBy: { sortOrder: "asc" },
    });
  },

  /** `roomIds` empty = applies to every room of the property. */
  create: async (
    data: { name: string; unit?: string | null; calcMode: CalcMode; defaultPrice: number; sortOrder?: number; propertyId: string },
    roomIds: string[] = []
  ) => {
    await assertOwnsProperty(data.propertyId);
    await assertRoomsInProperty(data.propertyId, roomIds);
    return prisma.feeType.create({
      data: { ...data, userId: getUserId(), rooms: { create: [...new Set(roomIds)].map((roomId) => ({ roomId })) } },
      include: feeTypeInclude,
    });
  },

  /** `roomIds` undefined = keep current scope; empty array = reset to all rooms. */
  update: async (
    id: string,
    data: { name?: string; unit?: string | null; calcMode?: CalcMode; defaultPrice?: number; sortOrder?: number; isActive?: boolean },
    roomIds?: string[]
  ) => {
    const existing = await prisma.feeType.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy loại phí");
    if (roomIds) await assertRoomsInProperty(existing.propertyId, roomIds);
    return prisma.feeType.update({
      where: { id },
      data: {
        ...data,
        ...(roomIds && {
          rooms: { deleteMany: {}, create: [...new Set(roomIds)].map((roomId) => ({ roomId })) },
        }),
      },
      include: feeTypeInclude,
    });
  },

  delete: async (id: string) => {
    const existing = await prisma.feeType.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy loại phí");
    return prisma.feeType.update({ where: { id }, data: { isActive: false } });
  },
};
