import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const propertyId = req.nextUrl.searchParams.get("propertyId");
    if (!propertyId) return error("Thiếu propertyId");
    const data = await prisma.feeType.findMany({
      where: { userId, propertyId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { name, unit, calcMode, defaultPrice, sortOrder, propertyId } = await req.json();
    if (!name || !calcMode || defaultPrice == null || !propertyId) return error("Thiếu thông tin loại phí");
    const data = await prisma.feeType.create({
      data: { name, unit, calcMode, defaultPrice, sortOrder, propertyId, userId },
    });
    return success(data, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
