import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  BudgetPeriod,
  BudgetLineItem,
  BudgetVersion,
  BudgetFilters,
  CoverageSummary,
  UpsertLineItemParams,
  ForecastHistoryEntry,
} from "@/types/budget";

interface BudgetState {
  // Data
  periods: BudgetPeriod[];
  selectedPeriod: BudgetPeriod | null;
  coverage: CoverageSummary | null;
  versions: BudgetVersion[];
  forecastHistory: Record<string, ForecastHistoryEntry[]>;

  // UI
  loading: boolean;
  error: string | null;

  // Actions
  fetchPeriods: (orgId: string, filters?: BudgetFilters) => Promise<void>;
  fetchPeriod: (periodId: string) => Promise<void>;
  createPeriod: (params: {
    orgId: string; userId: string; siteId: string;
    commodityId: string; budgetYear: number; notes?: string; currency?: string;
  }) => Promise<BudgetPeriod>;
  upsertLineItem: (periodId: string, data: UpsertLineItemParams & { userId?: string }) => Promise<BudgetLineItem>;
  upsertLineItems: (periodId: string, items: UpsertLineItemParams[], userId?: string) => Promise<BudgetLineItem[]>;
  deleteLineItem: (periodId: string, lineItemId: string, userId?: string) => Promise<void>;
  lockBudget: (periodId: string, userId: string) => Promise<void>;
  unlockBudget: (periodId: string, userId: string) => Promise<void>;
  fetchForecastHistory: (periodId: string, lineItemId: string) => Promise<ForecastHistoryEntry[]>;
  batchForecastUpdate: (periodId: string, updates: { budgetMonth: string; forecastVolume?: number | null; forecastPrice?: number | null }[], note: string, userId: string) => Promise<void>;
  fetchCoverage: (orgId: string, commodityId?: string, siteId?: string) => Promise<void>;
  fetchVersions: (periodId: string) => Promise<void>;
  createSnapshot: (periodId: string, userId: string, name?: string) => Promise<void>;
  restoreVersion: (periodId: string, versionNumber: number, userId: string) => Promise<void>;
  clearError: () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  periods: [],
  selectedPeriod: null,
  coverage: null,
  versions: [],
  forecastHistory: {},
  loading: false,
  error: null,

  fetchPeriods: async (orgId, filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (filters?.siteId) params.set("siteId", filters.siteId);
      if (filters?.commodityId) params.set("commodityId", filters.commodityId);
      if (filters?.budgetYear) params.set("budgetYear", String(filters.budgetYear));
      if (filters?.status) params.set("status", filters.status);
      const res = await fetch(`${API_BASE}/api/v2/budget/periods?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const periods = await res.json();
      set({ periods, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchPeriod: async (periodId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const period = await res.json();
      set({ selectedPeriod: period, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createPeriod: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const period = await res.json();
      set((s) => ({ periods: [period, ...s.periods], loading: false }));
      return period;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  upsertLineItem: async (periodId, data) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const item = await res.json();
      // Refresh the period
      await get().fetchPeriod(periodId);
      return item;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  upsertLineItems: async (periodId, items, userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      await get().fetchPeriod(periodId);
      return result;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  deleteLineItem: async (periodId, lineItemId, userId) => {
    try {
      const params = userId ? `?userId=${userId}` : "";
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/line-items/${lineItemId}${params}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await get().fetchPeriod(periodId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  lockBudget: async (periodId, userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await get().fetchPeriod(periodId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  unlockBudget: async (periodId, userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await get().fetchPeriod(periodId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  fetchForecastHistory: async (periodId, lineItemId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/line-items/${lineItemId}/forecast-history`);
      if (!res.ok) throw new Error((await res.json()).error);
      const history: ForecastHistoryEntry[] = await res.json();
      set((s) => ({ forecastHistory: { ...s.forecastHistory, [lineItemId]: history } }));
      return history;
    } catch (err) {
      set({ error: (err as Error).message });
      return [];
    }
  },

  batchForecastUpdate: async (periodId, updates, note, userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/line-items/forecast-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, note, userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await get().fetchPeriod(periodId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  fetchCoverage: async (orgId, commodityId, siteId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      if (siteId) params.set("siteId", siteId);
      const res = await fetch(`${API_BASE}/api/v2/budget/coverage?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const coverage = await res.json();
      set({ coverage, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchVersions: async (periodId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/versions`);
      if (!res.ok) throw new Error((await res.json()).error);
      const versions = await res.json();
      set({ versions });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  createSnapshot: async (periodId, userId, name) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await get().fetchVersions(periodId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  restoreVersion: async (periodId, versionNumber, userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/budget/periods/${periodId}/versions/${versionNumber}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await get().fetchPeriod(periodId);
      await get().fetchVersions(periodId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
