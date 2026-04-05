import { transactionRepo } from "@/lib/repositories/transaction.repo";
import { billingRepo } from "@/lib/repositories/billing.repo";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

type Period = "week" | "month" | "quarter" | "year";

function getDateRange(period: Period, date: Date) {
  switch (period) {
    case "week":
      return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
    case "month":
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case "quarter":
      return { start: startOfQuarter(date), end: endOfQuarter(date) };
    case "year":
      return { start: startOfYear(date), end: endOfYear(date) };
  }
}

export const dashboardService = {
  getStats: async (userId: string, period: Period = "month", date: Date = new Date()) => {
    const { start, end } = getDateRange(period, date);

    const [txStats, categoryStats, recentTx, billingPeriods] = await Promise.all([
      transactionRepo.getStats(userId, start, end),
      transactionRepo.getByCategory(userId, start, end),
      prisma.transaction.findMany({
        where: { userId, date: { gte: start, lte: end } },
        include: { category: true },
        orderBy: { date: "desc" },
        take: 10,
      }),
      billingRepo.findMany(userId),
    ]);

    // Calculate rental profit for the period
    const relevantBilling = billingPeriods.filter((bp) => {
      const bpDate = new Date(bp.year, bp.month - 1);
      return bpDate >= start && bpDate <= end;
    });

    let rentalIncome = 0;
    let rentalCost = 0;
    for (const bp of relevantBilling) {
      const collected = bp.totalCollected ?? bp.items.reduce((s, i) => s + (i.isPaid ? i.totalAmount : 0), 0);
      rentalIncome += collected;
      rentalCost += (bp.landlordPayment ?? 0) + (bp.actualElectricBill ?? 0);
    }

    const categories = await prisma.category.findMany({ where: { userId } });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return {
      totalIncome: txStats.totalIncome,
      totalExpense: txStats.totalExpense,
      netAmount: txStats.totalIncome - txStats.totalExpense,
      rentalProfit: rentalIncome - rentalCost,
      rentalIncome,
      rentalCost,
      categoryBreakdown: categoryStats.map((g) => ({
        categoryId: g.categoryId,
        category: catMap.get(g.categoryId),
        type: g.type,
        total: g._sum.amount ?? 0,
      })),
      recentTransactions: recentTx,
      period: { start, end, type: period },
    };
  },

  getMonthlyTrend: async (userId: string, months: number = 6) => {
    const now = new Date();
    const trends = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const stats = await transactionRepo.getStats(userId, start, end);
      trends.push({
        month: date.toISOString().slice(0, 7),
        income: stats.totalIncome,
        expense: stats.totalExpense,
        net: stats.totalIncome - stats.totalExpense,
      });
    }

    return trends;
  },
};
