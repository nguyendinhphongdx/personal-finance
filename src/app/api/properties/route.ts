import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireAuth();
    const data = await prisma.property.findMany({
      where: { userId, isActive: true },
      include: {
        rooms: {
          where: { isActive: true },
          include: { tenants: { where: { moveOutDate: null } } },
          orderBy: [{ floor: "asc" }, { name: "asc" }],
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { name, address, numFloors, monthlyRent, landlordName, landlordPhone, notes } = await req.json();
    if (!name) return error("Vui lòng nhập tên nhà");

    const property = await prisma.property.create({
      data: { name, address, numFloors: numFloors || 1, monthlyRent, landlordName, landlordPhone, notes, userId },
    });

    // Seed default fee types for this property
    await prisma.feeType.createMany({
      data: [
        { name: "Tiền điện", unit: "kWh", calcMode: "PER_UNIT", defaultPrice: 4000, sortOrder: 1, isDefault: true, propertyId: property.id, userId },
        { name: "Tiền nước", unit: "người", calcMode: "PER_PERSON", defaultPrice: 50000, sortOrder: 2, isDefault: true, propertyId: property.id, userId },
        { name: "Tiền mạng", calcMode: "FIXED", defaultPrice: 50000, sortOrder: 3, isDefault: true, propertyId: property.id, userId },
      ],
    });

    return success(property, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
