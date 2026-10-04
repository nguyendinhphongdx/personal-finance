import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { getUserId } from "@/lib/request-context";

// Guards for foreign keys supplied by the client: ensure the referenced record
// belongs to the current user before linking new data to it.

export async function assertOwnsProperty(id: string) {
  const property = await prisma.property.findFirst({ where: { id, userId: getUserId() } });
  if (!property) throw new NotFoundError("Không tìm thấy nhà");
  return property;
}

export async function assertOwnsRoom(id: string) {
  const room = await prisma.room.findFirst({ where: { id, userId: getUserId() } });
  if (!room) throw new NotFoundError("Không tìm thấy phòng");
  return room;
}

export async function assertOwnsCategory(id: string) {
  const category = await prisma.category.findFirst({ where: { id, userId: getUserId() } });
  if (!category) throw new NotFoundError("Không tìm thấy danh mục");
  return category;
}
