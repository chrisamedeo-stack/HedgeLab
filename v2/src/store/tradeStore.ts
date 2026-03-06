import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  FinancialTrade,
  TradeWithAllocations,
  CreateTradeParams,
  UpdateTradeParams,
  TradeFilters,
} from "@/types/trades";

interface TradeState {
  // Data
  trades: FinancialTrade[];
  selectedTrade: TradeWithAllocations | null;

  // Filters
  filters: Partial<TradeFilters>;

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  fetchTrades: (orgId: string, filters?: Partial<TradeFilters>) => Promise<void>;
  fetchTrade: (tradeId: string) => Promise<void>;
  createTrade: (params: CreateTradeParams) => Promise<FinancialTrade>;
  createTrades: (params: CreateTradeParams[]) => Promise<FinancialTrade[]>;
  updateTrade: (tradeId: string, userId: string, changes: UpdateTradeParams) => Promise<FinancialTrade>;
  cancelTrade: (tradeId: string, userId: string, reason?: string) => Promise<void>;
  setFilters: (filters: Partial<TradeFilters>) => void;
  clearError: () => void;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

export const useTradeStore = create<TradeState>((set) => ({
  trades: [],
  selectedTrade: null,
  filters: {},
  loading: false,
  error: null,

  fetchTrades: async (orgId, filters) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v2/trades${qs({ orgId, ...filters })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const trades = await res.json();
      set({ trades, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchTrade: async (tradeId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v2/trades/${tradeId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const selectedTrade = await res.json();
      set({ selectedTrade, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createTrade: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v2/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const trade = await res.json();
      set((s) => ({ trades: [trade, ...s.trades], loading: false }));
      return trade;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  createTrades: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v2/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const trades = await res.json();
      set((s) => ({ trades: [...trades, ...s.trades], loading: false }));
      return trades;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateTrade: async (tradeId, userId, changes) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v2/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...changes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        trades: s.trades.map((t) => (t.id === tradeId ? updated : t)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  cancelTrade: async (tradeId, userId, reason) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(
        `${API_BASE}/api/v2/trades/${tradeId}?userId=${userId}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const cancelled = await res.json();
      set((s) => ({
        trades: s.trades.map((t) => (t.id === tradeId ? cancelled : t)),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  setFilters: (filters) => set({ filters }),
  clearError: () => set({ error: null }),
}));
