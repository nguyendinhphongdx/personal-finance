import { NextRequest } from "next/server";
import { roomAssignmentRepo } from "@/lib/repositories/room.repo";
import { success, withUserContext, handleApiError } from "@/lib/api-utils";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async () => {
      const { id } = await params;
      const data = await roomAssignmentRepo.moveOut(id);
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
      await roomAssignmentRepo.delete(id);
      return success({ deleted: true });
    });
  } catch (err) {
    return handleApiError(err);
  }
}
