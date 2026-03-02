import { create } from "zustand";
import type {
  MarketPrice,
  CreatePriceParams,
  PriceFilters,
} from "@/types/market";

interface MarketState {
  prices: MarketPrice[];
  latestPrices: MarketPrice[];
  loading: boolean;
  error: string | null;

  fetchPrices: (filters?: PriceFilters) => Promise<void>;
  fetchLatestPrices: (commodityId: string) => Promise<void>;
  createPrices: (params: CreatePriceParams[]) => Promise<MarketPrice[]>;
  clearError: () => void;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

export const useMarketStore = create<MarketState>((set) => ({
  prices: [],
  latestPrices: [],
  loading: false,
  error: null,

  fetchPrices: async (filters) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/market/prices${qs({
        commodityId: filters?.commodityId,
        contractMonth: filters?.contractMonth,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        priceType: filters?.priceType,
      })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const prices = await res.json();
      set({ prices, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchLatestPrices: async (commodityId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/market/prices/latest?commodityId=${commodityId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const latestPrices = await res.json();
      set({ latestPrices, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createPrices: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/market/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      const created = Array.isArray(result) ? result : [result];
      set((s) => ({ prices: [...created, ...s.prices], loading: false }));
      return created;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
