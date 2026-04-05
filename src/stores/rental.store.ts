import { create } from "zustand";

interface Property {
  id: string;
  name: string;
  address?: string;
  numFloors: number;
  monthlyRent?: number;
  landlordName?: string;
  landlordPhone?: string;
  notes?: string;
  isActive: boolean;
  rooms: Room[];
}

interface Room {
  id: string;
  name: string;
  floor: number;
  price: number;
  isActive: boolean;
  propertyId: string;
  tenants: Tenant[];
  contracts: Contract[];
}

interface Tenant {
  id: string;
  name: string;
  phone?: string;
  idNumber?: string;
  isFamily: boolean;
  moveInDate: string;
  moveOutDate?: string;
  roomId: string;
  room?: { id: string; name: string; floor: number };
}

interface Contract {
  id: string;
  roomId: string;
  startDate: string;
  endDate?: string;
  fileUrl: string;
  fileName: string;
  room?: { id: string; name: string };
}

interface FeeType {
  id: string;
  name: string;
  unit?: string;
  calcMode: "PER_UNIT" | "PER_PERSON" | "FIXED";
  defaultPrice: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  propertyId: string;
}

interface BillingPeriod {
  id: string;
  month: number;
  year: number;
  isLocked: boolean;
  actualElectricBill?: number;
  landlordPayment?: number;
  totalCollected?: number;
  notes?: string;
  propertyId: string;
  items: BillingItem[];
  lockedAt?: string;
}

interface BillingItem {
  id: string;
  roomId: string;
  snapshotRoomName: string;
  snapshotFloor: number;
  snapshotPrice: number;
  snapshotTenants: { name: string; isFamily: boolean }[];
  snapshotNumPeople: number;
  fees: BillingItemFee[];
  totalAmount: number;
  isPaid: boolean;
  paidAt?: string;
}

interface BillingItemFee {
  id: string;
  feeName: string;
  calcMode: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

interface RentalState {
  properties: Property[];
  selectedPropertyId: string | null;
  rooms: Room[];
  tenants: Tenant[];
  contracts: Contract[];
  feeTypes: FeeType[];
  currentBilling: BillingPeriod | null;
  loading: boolean;
  setLoading: (l: boolean) => void;
  setSelectedPropertyId: (id: string | null) => void;
  fetchProperties: () => Promise<void>;
  fetchRooms: (propertyId?: string) => Promise<void>;
  fetchTenants: (propertyId?: string) => Promise<void>;
  fetchFeeTypes: (propertyId: string) => Promise<void>;
  fetchBillingPeriod: (propertyId: string, month: number, year: number) => Promise<void>;
}

export const useRentalStore = create<RentalState>((set, get) => ({
  properties: [],
  selectedPropertyId: null,
  rooms: [],
  tenants: [],
  contracts: [],
  feeTypes: [],
  currentBilling: null,
  loading: false,
  setLoading: (loading) => set({ loading }),
  setSelectedPropertyId: (id) => set({ selectedPropertyId: id }),

  fetchProperties: async () => {
    const res = await fetch("/api/properties");
    const data = await res.json();
    if (data.success) {
      set({ properties: data.data });
      // Auto-select first if none selected
      if (!get().selectedPropertyId && data.data.length > 0) {
        set({ selectedPropertyId: data.data[0].id });
      }
    }
  },

  fetchRooms: async (propertyId) => {
    set({ loading: true });
    const pid = propertyId || get().selectedPropertyId;
    const query = pid ? `?propertyId=${pid}` : "";
    const res = await fetch(`/api/rooms${query}`);
    const data = await res.json();
    if (data.success) set({ rooms: data.data });
    set({ loading: false });
  },

  fetchTenants: async (propertyId) => {
    const pid = propertyId || get().selectedPropertyId;
    const query = pid ? `?propertyId=${pid}` : "";
    const res = await fetch(`/api/tenants${query}`);
    const data = await res.json();
    if (data.success) set({ tenants: data.data });
  },

  fetchFeeTypes: async (propertyId) => {
    const res = await fetch(`/api/fee-types?propertyId=${propertyId}`);
    const data = await res.json();
    if (data.success) set({ feeTypes: data.data });
  },

  fetchBillingPeriod: async (propertyId, month, year) => {
    set({ loading: true });
    const res = await fetch(`/api/billing?propertyId=${propertyId}&month=${month}&year=${year}`);
    const data = await res.json();
    if (data.success) set({ currentBilling: data.data });
    else set({ currentBilling: null });
    set({ loading: false });
  },
}));
