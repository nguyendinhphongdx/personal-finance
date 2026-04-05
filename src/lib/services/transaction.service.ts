import { transactionRepo } from "@/lib/repositories/transaction.repo";
import { prisma } from "@/lib/prisma";

export const transactionService = {
  getAll: (userId: string, filters?: { startDate?: string; endDate?: string; type?: string; categoryId?: string }) => {
    return transactionRepo.findMany(userId, filters);
  },

  create: (userId: string, data: { amount: number; type: "INCOME" | "EXPENSE"; description?: string; date: string; categoryId: string }) => {
    return transactionRepo.create({
      ...data,
      date: new Date(data.date),
      userId,
    });
  },

  update: (id: string, userId: string, data: { amount?: number; description?: string; date?: string; categoryId?: string }) => {
    return transactionRepo.update(id, userId, {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    });
  },

  delete: (id: string) => {
    return transactionRepo.delete(id);
  },

  getStats: (userId: string, startDate: Date, endDate: Date) => {
    return transactionRepo.getStats(userId, startDate, endDate);
  },

  getByCategory: async (userId: string, startDate: Date, endDate: Date) => {
    const grouped = await transactionRepo.getByCategory(userId, startDate, endDate);
    const categories = await prisma.category.findMany({ where: { userId } });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return grouped.map((g) => ({
      categoryId: g.categoryId,
      category: catMap.get(g.categoryId),
      type: g.type,
      total: g._sum.amount ?? 0,
    }));
  },
};
