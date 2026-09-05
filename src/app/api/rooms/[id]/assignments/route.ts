import { NextRequest } from "next/server";
import { roomAssignmentRepo } from "@/lib/repositories/room.repo";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const { tenantIds, moveInDate } = await req.json();
    if (!Array.isArray(tenantIds)) return error("Thiếu danh sách người thuê");
    const data = await roomAssignmentRepo.setRoomTenants(
      id,
      tenantIds,
      userId,
      moveInDate ? new Date(moveInDate) : new Date()
    );
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}
