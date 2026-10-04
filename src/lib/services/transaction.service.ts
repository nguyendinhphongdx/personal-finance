import { transactionRepo } from "@/lib/repositories/transaction.repo";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/request-context";

export const transactionService = {
  getAll: (filters?: { startDate?: string; endDate?: string; type?: string; categoryId?: string }) => {
    return transactionRepo.findMany(filters);
  },

  create: (data: { amount: number; type: "INCOME" | "EXPENSE"; description?: string; date: string; categoryId: string }) => {
    return transactionRepo.create({
      ...data,
      date: new Date(data.date),
    });
  },

  update: (id: string, data: { amount?: number; description?: string; date?: string; categoryId?: string }) => {
    return transactionRepo.update(id, {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    });
  },

  delete: (id: string) => {
    return transactionRepo.delete(id);
  },

  getStats: (startDate: Date, endDate: Date) => {
    return transactionRepo.getStats(startDate, endDate);
  },

  getByCategory: async (startDate: Date, endDate: Date) => {
    const grouped = await transactionRepo.getByCategory(startDate, endDate);
    const categories = await prisma.category.findMany({ where: { userId: getUserId() } });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return grouped.map((g) => ({
      categoryId: g.categoryId,
      category: catMap.get(g.categoryId),
      type: g.type,
      total: g._sum.amount ?? 0,
    }));
  },
};
