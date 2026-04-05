import { billingRepo } from "@/lib/repositories/billing.repo";

export const billingService = {
  getPeriod: (propertyId: string, month: number, year: number) => {
    return billingRepo.findByPeriod(propertyId, month, year);
  },

  getAllPeriods: (userId: string) => {
    return billingRepo.findMany(userId);
  },

  updatePeriodSummary: (
    periodId: string,
    data: { actualElectricBill?: number; landlordPayment?: number; totalCollected?: number; notes?: string }
  ) => {
    return billingRepo.updatePeriod(periodId, data);
  },

  lockPeriod: (periodId: string) => {
    return billingRepo.updatePeriod(periodId, { isLocked: true, lockedAt: new Date() });
  },

  unlockPeriod: (periodId: string) => {
    return billingRepo.updatePeriod(periodId, { isLocked: false, lockedAt: undefined });
  },

  togglePaid: (itemId: string, isPaid: boolean) => {
    return billingRepo.togglePaid(itemId, isPaid);
  },

  deletePeriod: (periodId: string) => {
    return billingRepo.deletePeriod(periodId);
  },
};
