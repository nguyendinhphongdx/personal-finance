import { NextRequest } from "next/server";
import { tenantRepo } from "@/lib/repositories/room.repo";
import { success, requireAuth, handleApiError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    if (body.moveOutDate) body.moveOutDate = new Date(body.moveOutDate);
    const data = await tenantRepo.update(id, body);
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await tenantRepo.delete(id);
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
