import { NextRequest } from "next/server";
import { tenantRepo } from "@/lib/repositories/room.repo";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    return await withUserContext(async () => {
      const propertyId = req.nextUrl.searchParams.get("propertyId") ?? undefined;
      const data = await tenantRepo.findMany(propertyId);
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withUserContext(async () => {
      const { name, phone, idNumber, isFamily, propertyId } = await req.json();
      if (!name || !propertyId) return error("Thiếu thông tin người thuê");
      const data = await tenantRepo.create({
        name,
        phone,
        idNumber,
        isFamily: isFamily ?? false,
        propertyId,
      });
      return success(data, 201);
    });
  } catch (err) {
    return handleApiError(err);
  }
}
