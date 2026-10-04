import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";
import { billingService } from "@/lib/services/billing.service";

export async function GET(req: NextRequest) {
  try {
    return await withUserContext(async (userId) => {
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

      const data = await prisma.billingPeriod.findFirst({
        where: { month, year, propertyId, userId },
        include: {
          items: {
            include: { fees: true, room: true },
            orderBy: [{ snapshotFloor: "asc" }, { snapshotRoomName: "asc" }],
          },
        },
      });
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withUserContext(async () => {
      const { month, year, propertyId } = await req.json();
      if (!month || !year || !propertyId) return error("Thiếu thông tin");
      const data = await billingService.generatePeriod(propertyId, month, year);
      return success(data, 201);
    });
  } catch (err) {
    return handleApiError(err);
  }
}
