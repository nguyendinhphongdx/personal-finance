import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireAuth();
    const data = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await req.json();
    const { name, type, icon, color } = body;

    if (!name || !type) return error("Thiếu tên hoặc loại danh mục");

    const data = await prisma.category.create({
      data: { name, type, icon, color, userId },
    });
    return success(data, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
