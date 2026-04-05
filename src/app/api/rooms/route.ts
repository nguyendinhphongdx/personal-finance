import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const propertyId = req.nextUrl.searchParams.get("propertyId");
    const data = await prisma.room.findMany({
      where: { userId, ...(propertyId && { propertyId }) },
      include: {
        tenants: { where: { moveOutDate: null }, orderBy: { moveInDate: "asc" } },
        contracts: { orderBy: { createdAt: "desc" }, take: 1 },
        property: { select: { id: true, name: true } },
      },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { name, floor, price, propertyId } = await req.json();
    if (!name || !floor || price == null || !propertyId) return error("Thiếu thông tin phòng");
    const data = await prisma.room.create({ data: { name, floor, price, propertyId, userId } });
    return success(data, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
