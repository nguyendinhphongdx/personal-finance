import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";
import { assertOwnsProperty } from "@/lib/repositories/ownership";

export async function GET(req: NextRequest) {
  try {
    return await withUserContext(async (userId) => {
      const propertyId = req.nextUrl.searchParams.get("propertyId");
      if (!propertyId) return error("Thiếu propertyId");
      const data = await prisma.feeType.findMany({
        where: { userId, propertyId, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withUserContext(async (userId) => {
      const { name, unit, calcMode, defaultPrice, sortOrder, propertyId } = await req.json();
      if (!name || !calcMode || defaultPrice == null || !propertyId) return error("Thiếu thông tin loại phí");
      await assertOwnsProperty(propertyId);
      const data = await prisma.feeType.create({
        data: { name, unit, calcMode, defaultPrice, sortOrder, propertyId, userId },
      });
      return success(data, 201);
    });
  } catch (err) {
    return handleApiError(err);
  }
}
