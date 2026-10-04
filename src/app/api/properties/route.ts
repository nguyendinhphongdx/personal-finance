import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";
import { propertyService } from "@/lib/services/property.service";

export async function GET() {
  try {
    return await withUserContext(async (userId) => {
      const data = await prisma.property.findMany({
        where: { userId, isActive: true },
        include: {
          rooms: {
            where: { isActive: true },
            include: { assignments: { where: { moveOutDate: null } } },
            orderBy: [{ floor: "asc" }, { name: "asc" }],
          },
        },
        orderBy: { createdAt: "asc" },
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
      const { name, address, numFloors, monthlyRent, landlordName, landlordPhone, notes } = await req.json();
      if (!name) return error("Vui lòng nhập tên nhà");

      const property = await propertyService.create({ name, address, numFloors, monthlyRent, landlordName, landlordPhone, notes });
      return success(property, 201);
    });
  } catch (err) {
    return handleApiError(err);
  }
}
