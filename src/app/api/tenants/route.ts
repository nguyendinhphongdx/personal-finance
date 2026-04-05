import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const propertyId = req.nextUrl.searchParams.get("propertyId");
    const data = await prisma.tenant.findMany({
      where: {
        userId,
        ...(propertyId && { room: { propertyId } }),
      },
      include: { room: { include: { property: { select: { id: true, name: true } } } } },
      orderBy: { moveInDate: "desc" },
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { name, phone, idNumber, isFamily, moveInDate, roomId } = await req.json();
    if (!name || !moveInDate || !roomId) return error("Thiếu thông tin người thuê");
    const data = await prisma.tenant.create({
      data: { name, phone, idNumber, isFamily: isFamily ?? false, moveInDate: new Date(moveInDate), roomId, userId },
      include: { room: true },
    });
    return success(data, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
