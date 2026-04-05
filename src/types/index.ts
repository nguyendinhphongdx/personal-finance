export type TransactionType = "INCOME" | "EXPENSE";
export type CalcMode = "PER_UNIT" | "PER_PERSON" | "FIXED";

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Transaction
export interface TransactionFormData {
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  categoryId: string;
}

// Category
export interface CategoryFormData {
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
}

// Room
export interface RoomFormData {
  name: string;
  floor: number;
  price: number;
}

// Tenant
export interface TenantFormData {
  name: string;
  phone?: string;
  idNumber?: string;
  isFamily: boolean;
  moveInDate: string;
  roomId: string;
}

// Fee Type
export interface FeeTypeFormData {
  name: string;
  unit?: string;
  calcMode: CalcMode;
  defaultPrice: number;
  sortOrder?: number;
}

// Billing
export interface BillingInput {
  roomId: string;
  electricityUnits?: number;
  fees: {
    feeName: string;
    calcMode: CalcMode;
    unitPrice: number;
    quantity: number;
  }[];
}

export interface BillingPeriodFormData {
  month: number;
  year: number;
  actualElectricBill?: number;
  landlordPayment?: number;
  totalCollected?: number;
  notes?: string;
  items: BillingInput[];
}

// Dashboard
export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  rentalProfit: number;
  recentTransactions: unknown[];
}

export interface TenantSnapshot {
  name: string;
  isFamily: boolean;
}
