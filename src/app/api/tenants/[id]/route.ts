import { NextRequest } from "next/server";
import { tenantRepo } from "@/lib/repositories/room.repo";
import { success, withUserContext, handleApiError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async () => {
      const { id } = await params;
      const { name, phone, idNumber, isFamily } = await req.json();
      const data = await tenantRepo.update(id, { name, phone, idNumber, isFamily });
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
      await tenantRepo.delete(id);
      return success({ deleted: true });
    });
  } catch (err) {
    return handleApiError(err);
  }
}
