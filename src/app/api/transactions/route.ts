import { NextRequest } from "next/server";
import { transactionService } from "@/lib/services/transaction.service";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    return await withUserContext(async () => {
      const { searchParams } = req.nextUrl;
      const filters = {
        startDate: searchParams.get("startDate") ?? undefined,
        endDate: searchParams.get("endDate") ?? undefined,
        type: searchParams.get("type") ?? undefined,
        categoryId: searchParams.get("categoryId") ?? undefined,
      };
      const data = await transactionService.getAll(filters);
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withUserContext(async () => {
      const body = await req.json();
      const { amount, type, description, date, categoryId } = body;

      if (!amount || !type || !date || !categoryId) {
        return error("Thiếu thông tin bắt buộc");
      }

      const data = await transactionService.create({ amount, type, description, date, categoryId });
      return success(data, 201);
    });
  } catch (err) {
    return handleApiError(err);
  }
}
