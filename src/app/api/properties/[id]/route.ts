import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, withUserContext, handleApiError, NotFoundError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withUserContext(async (userId) => {
      const { id } = await params;
      const { name, address, numFloors, monthlyRent, landlordName, landlordPhone, notes, metadata } = await req.json();
      const existing = await prisma.property.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError("Không tìm thấy nhà");
      const data = await prisma.property.update({
        where: { id },
        data: { name, address, numFloors, monthlyRent, landlordName, landlordPhone, notes, metadata },
      });
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
      const existing = await prisma.property.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError("Không tìm thấy nhà");
      await prisma.property.update({ where: { id }, data: { isActive: false } });
      return success({ deleted: true });
    });
  } catch (err) {
    return handleApiError(err);
  }
}
