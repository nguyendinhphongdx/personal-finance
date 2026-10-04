import { NextRequest } from "next/server";
import { transactionService } from "@/lib/services/transaction.service";
import { success, withUserContext, handleApiError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async () => {
      const { id } = await params;
      const body = await req.json();
      const data = await transactionService.update(id, body);
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
      await transactionService.delete(id);
      return success({ deleted: true });
    });
  } catch (err) {
    return handleApiError(err);
  }
}
