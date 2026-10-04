import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, withUserContext, handleApiError, NotFoundError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async (userId) => {
      const { id } = await params;
      const { name, type, icon, color } = await req.json();
      const existing = await prisma.category.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError("Không tìm thấy danh mục");
      const data = await prisma.category.update({ where: { id }, data: { name, type, icon, color } });
      return success(data);
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async (userId) => {
      const { id } = await params;
      const existing = await prisma.category.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError("Không tìm thấy danh mục");
      await prisma.category.delete({ where: { id } });
      return success({ deleted: true });
    });
  } catch (err) {
    return handleApiError(err);
  }
}
