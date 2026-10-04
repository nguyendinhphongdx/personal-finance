import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { getUserId } from "@/lib/request-context";
import { assertOwnsCategory } from "./ownership";

export const transactionRepo = {
  findMany: (filters?: { startDate?: string; endDate?: string; type?: string; categoryId?: string }) => {
    return prisma.transaction.findMany({
      where: {
        userId: getUserId(),
        ...(filters?.type && { type: filters.type as "INCOME" | "EXPENSE" }),
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.startDate || filters?.endDate
          ? {
              date: {
                ...(filters.startDate && { gte: new Date(filters.startDate) }),
                ...(filters.endDate && { lte: new Date(filters.endDate) }),
              },
            }
          : {}),
      },
      include: { category: true },
      orderBy: { date: "desc" },
    });
  },

  create: async (data: { amount: number; type: "INCOME" | "EXPENSE"; description?: string; date: Date; categoryId: string }) => {
    await assertOwnsCategory(data.categoryId);
    return prisma.transaction.create({
      data: { ...data, userId: getUserId() },
      include: { category: true },
    });
  },

  update: async (id: string, data: { amount?: number; description?: string; date?: Date; categoryId?: string }) => {
    const existing = await prisma.transaction.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy giao dịch");
    if (data.categoryId) await assertOwnsCategory(data.categoryId);
    return prisma.transaction.update({
      where: { id },
      data,
      include: { category: true },
    });
  },

  delete: async (id: string) => {
    const existing = await prisma.transaction.findFirst({ where: { id, userId: getUserId() } });
    if (!existing) throw new NotFoundError("Không tìm thấy giao dịch");
    return prisma.transaction.delete({ where: { id } });
  },

  getStats: async (startDate: Date, endDate: Date) => {
    const userId = getUserId();
    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: "INCOME", date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: "EXPENSE", date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
    ]);
    return {
      totalIncome: income._sum.amount ?? 0,
      totalExpense: expense._sum.amount ?? 0,
    };
  },

  getByCategory: (startDate: Date, endDate: Date) => {
    return prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { userId: getUserId(), date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });
  },
};
