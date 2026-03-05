import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  MtmSnapshot,
  MtmSummary,
  PositionLimit,
  CreateLimitParams,
  UpdateLimitParams,
  LimitCheck,
  ExposureBucket,
  CounterpartyExposure,
} from "@/types/risk";

interface RiskState {
  // Data
  snapshots: MtmSnapshot[];
  summary: MtmSummary | null;
  history: MtmSnapshot[];
  limits: PositionLimit[];
  limitChecks: LimitCheck[];
  exposureByTenor: ExposureBucket[];
  exposureByCounterparty: CounterpartyExposure[];

  // UI state
  loading: boolean;
  error: string | null;

  // MTM actions
  fetchSnapshots: (orgId: string, commodityId?: string) => Promise<void>;
  fetchSummary: (orgId: string) => Promise<void>;
  fetchHistory: (orgId: string, days?: number) => Promise<void>;
  runMtm: (orgId: string, userId: string) => Promise<void>;

  // Limit actions
  fetchLimits: (orgId: string) => Promise<void>;
  createLimit: (params: CreateLimitParams) => Promise<PositionLimit>;
  updateLimit: (id: string, userId: string, changes: UpdateLimitParams) => Promise<PositionLimit>;
  deleteLimit: (id: string, userId: string) => Promise<void>;
  checkLimits: (orgId: string, userId: string) => Promise<void>;

  // Exposure actions
  fetchExposureByTenor: (orgId: string, commodityId?: string) => Promise<void>;
  fetchExposureByCounterparty: (orgId: string) => Promise<void>;

  clearError: () => void;
}

export const useRiskStore = create<RiskState>((set) => ({
  snapshots: [],
  summary: null,
  history: [],
  limits: [],
  limitChecks: [],
  exposureByTenor: [],
  exposureByCounterparty: [],
  loading: false,
  error: null,

  fetchSnapshots: async (orgId, commodityId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      const res = await fetch(`${API_BASE}/api/risk/mtm?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const snapshots = await res.json();
      set({ snapshots, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchSummary: async (orgId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/risk/mtm/summary?orgId=${orgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const summary = await res.json();
      set({ summary, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchHistory: async (orgId, days) => {
    try {
      const params = new URLSearchParams({ orgId });
      if (days) params.set("days", String(days));
      const res = await fetch(`${API_BASE}/api/risk/mtm/history?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const history = await res.json();
      set({ history });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  runMtm: async (orgId, userId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/risk/mtm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchLimits: async (orgId) => {
    try {
      const res = await fetch(`${API_BASE}/api/risk/limits?orgId=${orgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const limits = await res.json();
      set({ limits });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  createLimit: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/risk/limits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const limit = await res.json();
      set((s) => ({ limits: [limit, ...s.limits], loading: false }));
      return limit;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateLimit: async (id, userId, changes) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/risk/limits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...changes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      set((s) => ({
        limits: s.limits.map((l) => (l.id === id ? updated : l)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  deleteLimit: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/risk/limits/${id}?userId=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      set((s) => ({
        limits: s.limits.filter((l) => l.id !== id),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  checkLimits: async (orgId, userId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/risk/limits/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const limitChecks = await res.json();
      set({ limitChecks, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchExposureByTenor: async (orgId, commodityId) => {
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      const res = await fetch(`${API_BASE}/api/risk/exposure/tenor?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const exposureByTenor = await res.json();
      set({ exposureByTenor });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchExposureByCounterparty: async (orgId) => {
    try {
      const res = await fetch(`${API_BASE}/api/risk/exposure/counterparty?orgId=${orgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const exposureByCounterparty = await res.json();
      set({ exposureByCounterparty });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
