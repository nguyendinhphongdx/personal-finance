import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  transactionDialogOpen: boolean;
  setTransactionDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  transactionDialogOpen: false,
  setTransactionDialogOpen: (open) => set({ transactionDialogOpen: open }),
}));
