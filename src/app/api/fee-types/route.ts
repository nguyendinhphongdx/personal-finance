import { NextRequest } from "next/server";
import { feeTypeRepo } from "@/lib/repositories/room.repo";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    return await withUserContext(async () => {
      const propertyId = req.nextUrl.searchParams.get("propertyId");
      if (!propertyId) return error("Thiếu propertyId");
      const data = await feeTypeRepo.findMany(propertyId);
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withUserContext(async () => {
      const { name, unit, calcMode, defaultPrice, sortOrder, propertyId, roomIds } = await req.json();
      if (!name || !calcMode || defaultPrice == null || !propertyId) return error("Thiếu thông tin loại phí");
      if (roomIds !== undefined && !Array.isArray(roomIds)) return error("Danh sách phòng không hợp lệ");
      const data = await feeTypeRepo.create({ name, unit, calcMode, defaultPrice, sortOrder, propertyId }, roomIds);
      return success(data, 201);
    });
  } catch (err) {
    return handleApiError(err);
  }
}
