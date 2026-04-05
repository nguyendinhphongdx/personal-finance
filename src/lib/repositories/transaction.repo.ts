import { prisma } from "@/lib/prisma";

export const transactionRepo = {
  findMany: (userId: string, filters?: { startDate?: string; endDate?: string; type?: string; categoryId?: string }) => {
    return prisma.transaction.findMany({
      where: {
        userId,
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

  create: (data: { amount: number; type: "INCOME" | "EXPENSE"; description?: string; date: Date; categoryId: string; userId: string }) => {
    return prisma.transaction.create({
      data,
      include: { category: true },
    });
  },

  update: (id: string, userId: string, data: { amount?: number; description?: string; date?: Date; categoryId?: string }) => {
    return prisma.transaction.update({
      where: { id },
      data,
      include: { category: true },
    });
  },

  delete: (id: string) => {
    return prisma.transaction.delete({ where: { id } });
  },

  getStats: async (userId: string, startDate: Date, endDate: Date) => {
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

  getByCategory: (userId: string, startDate: Date, endDate: Date) => {
    return prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });
  },
};
