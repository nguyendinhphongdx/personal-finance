import { create } from "zustand";

interface Transaction {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  description?: string;
  date: string;
  categoryId: string;
  category?: { id: string; name: string; icon?: string; color?: string };
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon?: string;
  color?: string;
  isDefault: boolean;
}

interface Budget {
  id: string;
  amount: number;
  month: number;
  year: number;
  categoryId: string;
  category?: Category;
}

interface TransactionState {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  loading: boolean;
  setTransactions: (t: Transaction[]) => void;
  setCategories: (c: Category[]) => void;
  setBudgets: (b: Budget[]) => void;
  setLoading: (l: boolean) => void;
  fetchTransactions: (params?: Record<string, string>) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchBudgets: (month: number, year: number) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  categories: [],
  budgets: [],
  loading: false,
  setTransactions: (transactions) => set({ transactions }),
  setCategories: (categories) => set({ categories }),
  setBudgets: (budgets) => set({ budgets }),
  setLoading: (loading) => set({ loading }),

  fetchTransactions: async (params) => {
    set({ loading: true });
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await fetch(`/api/transactions${query}`);
    const data = await res.json();
    if (data.success) set({ transactions: data.data });
    set({ loading: false });
  },

  fetchCategories: async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    if (data.success) set({ categories: data.data });
  },

  fetchBudgets: async (month, year) => {
    const res = await fetch(`/api/budgets?month=${month}&year=${year}`);
    const data = await res.json();
    if (data.success) set({ budgets: data.data });
  },
}));
