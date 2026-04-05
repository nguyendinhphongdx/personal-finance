import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get("propertyId");
    const month = parseInt(searchParams.get("month") ?? "");
    const year = parseInt(searchParams.get("year") ?? "");

    if (!propertyId) {
      // Return all periods
      const data = await prisma.billingPeriod.findMany({
        where: { userId },
        include: { items: { include: { fees: true } }, property: { select: { id: true, name: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
      return success(data);
    }

    if (isNaN(month) || isNaN(year)) return error("Thiếu tháng hoặc năm");

    const data = await prisma.billingPeriod.findUnique({
      where: { month_year_propertyId: { month, year, propertyId } },
      include: {
        items: {
          include: { fees: true, room: true },
          orderBy: [{ snapshotFloor: "asc" }, { snapshotRoomName: "asc" }],
        },
      },
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { month, year, propertyId } = await req.json();
    if (!month || !year || !propertyId) return error("Thiếu thông tin");

    // Create or get period
    let period = await prisma.billingPeriod.findUnique({
      where: { month_year_propertyId: { month, year, propertyId } },
    });

    if (period?.isLocked) return error("Kỳ hóa đơn đã khóa, không thể tạo thêm");

    if (!period) {
      period = await prisma.billingPeriod.create({
        data: { month, year, propertyId, userId },
      });
    }

    // Auto-generate billing items from rooms
    const rooms = await prisma.room.findMany({
      where: { propertyId, isActive: true },
      include: { tenants: { where: { moveOutDate: null } } },
    });

    const feeTypes = await prisma.feeType.findMany({
      where: { propertyId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    for (const room of rooms) {
      if (room.tenants.length === 0) continue;

      const existing = await prisma.billingItem.findFirst({
        where: { billingPeriodId: period.id, roomId: room.id },
      });
      if (existing) continue; // Don't overwrite existing items

      const numPeople = room.tenants.length;
      const fees = feeTypes.map((ft) => {
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
          snapshotTenants: room.tenants.map((t) => ({ name: t.name, isFamily: t.isFamily })),
          snapshotNumPeople: numPeople,
          totalAmount: room.price + totalFees,
          fees: { create: fees },
        },
      });
    }

    // Re-fetch full period
    const data = await prisma.billingPeriod.findUnique({
      where: { id: period.id },
      include: {
        items: {
          include: { fees: true, room: true },
          orderBy: [{ snapshotFloor: "asc" }, { snapshotRoomName: "asc" }],
        },
      },
    });
    return success(data, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
