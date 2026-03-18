import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  PmTrade,
  PmTradeFilters,
  CreatePmTradeParams,
} from "@/types/pm";

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

interface PmTradeState {
  trades: PmTrade[];
  total: number;
  selectedTrade: PmTrade | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchTrades: (orgId: string, filters?: PmTradeFilters) => Promise<void>;
  fetchTrade: (id: string) => Promise<void>;
  createTrade: (params: CreatePmTradeParams) => Promise<PmTrade>;
  updateTrade: (id: string, updates: Record<string, unknown>) => Promise<PmTrade>;
  deleteTrade: (id: string) => Promise<void>;
  bulkAction: (action: string, tradeIds: string[], orgId: string, payload: Record<string, unknown>) => Promise<number>;
  clearError: () => void;
}

export const usePmTradeStore = create<PmTradeState>((set) => ({
  trades: [],
  total: 0,
  selectedTrade: null,
  loading: false,
  error: null,

  fetchTrades: async (orgId, filters) => {
    set({ loading: true, error: null });
    try {
      const p: Record<string, string | undefined> = { orgId };
      if (filters?.category) p.category = filters.category;
      if (filters?.commodity) p.commodity = filters.commodity;
      if (filters?.instrument) p.instrument = filters.instrument;
      if (filters?.direction) p.direction = filters.direction;
      if (filters?.portfolioId) p.portfolio_id = filters.portfolioId;
      if (filters?.orgNodeId) p.org_node_id = filters.orgNodeId;
      if (filters?.deliveryLocationId) p.delivery_location_id = filters.deliveryLocationId;
      if (filters?.budgetMonth) p.budget_month = filters.budgetMonth;
      if (filters?.isPriced !== undefined) p.is_priced = String(filters.isPriced);
      if (filters?.page) p.page = String(filters.page);
      if (filters?.pageSize) p.page_size = String(filters.pageSize);

      const res = await fetch(`${API_BASE}/api/pm/trades${qs(p)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      set({ trades: data.trades, total: data.total, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchTrade: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/pm/trades/${id}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const trade = await res.json();
      set({ selectedTrade: trade, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createTrade: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/pm/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const trade = await res.json();
      set((s) => ({ trades: [trade, ...s.trades], total: s.total + 1, loading: false }));
      return trade;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateTrade: async (id, updates) => {
    try {
      const res = await fetch(`${API_BASE}/api/pm/trades/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        trades: s.trades.map((t) => (t.id === id ? updated : t)),
        selectedTrade: s.selectedTrade?.id === id ? updated : s.selectedTrade,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  deleteTrade: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/pm/trades/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      set((s) => ({
        trades: s.trades.filter((t) => t.id !== id),
        total: s.total - 1,
        selectedTrade: s.selectedTrade?.id === id ? null : s.selectedTrade,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  bulkAction: async (action, tradeIds, orgId, payload) => {
    try {
      const res = await fetch(`${API_BASE}/api/pm/trades/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tradeIds, orgId, ...payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      return data.updated;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
