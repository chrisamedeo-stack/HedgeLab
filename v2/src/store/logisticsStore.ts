import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  Delivery,
  Inventory,
  RecordDeliveryParams,
  UpdateDeliveryParams,
  DeliveryFilters,
} from "@/types/logistics";

interface LogisticsState {
  deliveries: Delivery[];
  inventory: Inventory[];
  loading: boolean;
  error: string | null;

  fetchDeliveries: (orgId: string, filters?: Partial<DeliveryFilters>) => Promise<void>;
  fetchInventory: (params?: Record<string, string>) => Promise<void>;
  recordDelivery: (params: RecordDeliveryParams) => Promise<Delivery>;
  updateDelivery: (id: string, userId: string, changes: UpdateDeliveryParams) => Promise<Delivery>;
  cancelDelivery: (id: string, userId: string) => Promise<void>;
  recordInventorySnapshot: (params: Record<string, unknown>) => Promise<void>;
  clearError: () => void;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

export const useLogisticsStore = create<LogisticsState>((set) => ({
  deliveries: [],
  inventory: [],
  loading: false,
  error: null,

  fetchDeliveries: async (orgId, filters) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/logistics/deliveries${qs({ orgId, ...filters })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const deliveries = await res.json();
      set({ deliveries, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchInventory: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/logistics/inventory${qs(params ?? {})}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const inventory = await res.json();
      set({ inventory, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  recordDelivery: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/logistics/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const delivery = await res.json();
      set((s) => ({ deliveries: [delivery, ...s.deliveries], loading: false }));
      return delivery;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateDelivery: async (id, userId, changes) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/logistics/deliveries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...changes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        deliveries: s.deliveries.map((d) => (d.id === id ? updated : d)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  cancelDelivery: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(
        `${API_BASE}/api/logistics/deliveries/${id}?userId=${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const cancelled = await res.json();
      set((s) => ({
        deliveries: s.deliveries.map((d) => (d.id === id ? cancelled : d)),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  recordInventorySnapshot: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/logistics/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
