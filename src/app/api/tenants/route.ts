import { NextRequest } from "next/server";
import { tenantRepo } from "@/lib/repositories/room.repo";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const propertyId = req.nextUrl.searchParams.get("propertyId") ?? undefined;
    const data = await tenantRepo.findMany(userId, propertyId);
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { name, phone, idNumber, isFamily, propertyId } = await req.json();
    if (!name || !propertyId) return error("Thiếu thông tin người thuê");
    const data = await tenantRepo.create({
      name,
      phone,
      idNumber,
      isFamily: isFamily ?? false,
      propertyId,
      userId,
    });
    return success(data, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
