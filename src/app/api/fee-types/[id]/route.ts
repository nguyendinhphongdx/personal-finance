import { NextRequest } from "next/server";
import { feeTypeRepo } from "@/lib/repositories/room.repo";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async () => {
      const { id } = await params;
      const { name, unit, calcMode, defaultPrice, sortOrder, roomIds } = await req.json();
      if (roomIds !== undefined && !Array.isArray(roomIds)) return error("Danh sách phòng không hợp lệ");
      const data = await feeTypeRepo.update(id, { name, unit, calcMode, defaultPrice, sortOrder }, roomIds);
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async () => {
      const { id } = await params;
      await feeTypeRepo.delete(id);
      return success({ deleted: true });
    });
  } catch (err) {
    return handleApiError(err);
  }
}
