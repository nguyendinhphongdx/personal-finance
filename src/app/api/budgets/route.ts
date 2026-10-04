import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, withUserContext, handleApiError } from "@/lib/api-utils";
import { assertOwnsCategory } from "@/lib/repositories/ownership";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = req.nextUrl;
    const month = parseInt(searchParams.get("month") ?? "");
    const year = parseInt(searchParams.get("year") ?? "");

    if (isNaN(month) || isNaN(year)) return error("Thiếu tháng hoặc năm");

    const data = await prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withUserContext(async (userId) => {
      const body = await req.json();
      const { amount, month, year, categoryId } = body;

      if (!amount || !month || !year || !categoryId) return error("Thiếu thông tin");
      await assertOwnsCategory(categoryId);

      const data = await prisma.budget.upsert({
        where: { categoryId_month_year: { categoryId, month, year } },
        update: { amount },
        create: { amount, month, year, categoryId, userId },
        include: { category: true },
      });
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}
