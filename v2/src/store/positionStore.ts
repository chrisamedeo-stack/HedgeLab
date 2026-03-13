import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  Allocation,
  HedgeBookEntry,
  PhysicalPosition,
  LockedPosition,
  RolloverCandidate,
  SitePositionView,
  AllocateToSiteParams,
  ExecuteEFPParams,
  ExecuteOffsetParams,
  ExecuteRollParams,
  CreatePhysicalParams,
  BasisSummary,
} from "@/types/positions";

interface PositionState {
  // Data
  allocations: Allocation[];
  hedgeBook: { entries: HedgeBookEntry[]; byMonth: Record<string, HedgeBookEntry[]>; kpis: HedgeBookKPIs } | null;
  physicals: PhysicalPosition[];
  lockedPositions: LockedPosition[];
  siteView: SitePositionView | null;
  rollCandidates: { candidates: RolloverCandidate[]; grouped: Record<string, RolloverCandidate[]> } | null;
  basisSummary: BasisSummary | null;

  // Filters
  selectedRegion: string | null;
  selectedOrgUnit: string | null;
  selectedCommodity: string | null;

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  fetchAllocations: (params?: Record<string, string>) => Promise<void>;
  fetchHedgeBook: (orgId: string, commodityId?: string, regionGroupId?: string, orgUnitId?: string) => Promise<void>;
  fetchPhysicals: (params?: Record<string, string>) => Promise<void>;
  fetchLockedPositions: (params?: Record<string, string>) => Promise<void>;
  fetchSiteView: (siteId: string, commodityId?: string) => Promise<void>;
  fetchRollCandidates: (orgId: string, commodityId?: string, orgUnitId?: string) => Promise<void>;
  fetchBasisSummary: (orgId: string, commodityId?: string, orgUnitId?: string) => Promise<void>;
  allocate: (params: AllocateToSiteParams) => Promise<Allocation>;
  executeEFP: (params: ExecuteEFPParams) => Promise<LockedPosition>;
  executeOffset: (params: ExecuteOffsetParams) => Promise<Allocation>;
  executeRoll: (params: ExecuteRollParams) => Promise<void>;
  createPhysical: (params: CreatePhysicalParams) => Promise<PhysicalPosition>;
  cancelAllocation: (userId: string, allocationId: string) => Promise<void>;
  setSelectedRegion: (region: string | null) => void;
  setSelectedOrgUnit: (unitId: string | null) => void;
  setSelectedCommodity: (commodity: string | null) => void;
  clearError: () => void;
}

interface HedgeBookKPIs {
  totalAllocations: number;
  openVolume: number;
  lockedVolume: number;
  offsetVolume: number;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

export const usePositionStore = create<PositionState>((set) => ({
  allocations: [],
  hedgeBook: null,
  physicals: [],
  lockedPositions: [],
  siteView: null,
  rollCandidates: null,
  basisSummary: null,
  selectedRegion: null,
  selectedOrgUnit: null,
  selectedCommodity: null,
  loading: false,
  error: null,

  fetchAllocations: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/allocations${qs(params ?? {})}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const allocations = await res.json();
      set({ allocations, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchHedgeBook: async (orgId, commodityId, regionGroupId, orgUnitId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/hedge-book${qs({ orgId, commodityId, regionGroupId, orgUnitId })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const hedgeBook = await res.json();
      set({ hedgeBook, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchPhysicals: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/physicals${qs(params ?? {})}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const physicals = await res.json();
      set({ physicals, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchLockedPositions: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/locked${qs(params ?? {})}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const lockedPositions = await res.json();
      set({ lockedPositions, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchSiteView: async (siteId, commodityId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/site-view/${siteId}${qs({ commodityId })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const siteView = await res.json();
      set({ siteView, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchRollCandidates: async (orgId, commodityId, orgUnitId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/roll/candidates${qs({ orgId, commodityId, orgUnitId })}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const rollCandidates = await res.json();
      set({ rollCandidates, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchBasisSummary: async (orgId, commodityId, orgUnitId) => {
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      if (orgUnitId) params.set("orgUnitId", orgUnitId);
      const res = await fetch(`${API_BASE}/api/positions/basis?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const basisSummary = await res.json();
      set({ basisSummary });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  allocate: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const allocation = await res.json();
      set((s) => ({ allocations: [allocation, ...s.allocations], loading: false }));
      return allocation;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  executeEFP: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/efp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const locked = await res.json();
      set({ loading: false });
      return locked;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  executeOffset: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/offset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      set({ loading: false });
      return result;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  executeRoll: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  createPhysical: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/physicals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const physical = await res.json();
      set((s) => ({ physicals: [physical, ...s.physicals], loading: false }));
      return physical;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  cancelAllocation: async (userId, allocationId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/positions/allocations/${allocationId}?userId=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      set((s) => ({
        allocations: s.allocations.map((a) =>
          a.id === allocationId ? { ...a, status: "cancelled" as const } : a
        ),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setSelectedOrgUnit: (unitId) => set({ selectedOrgUnit: unitId }),
  setSelectedCommodity: (commodity) => set({ selectedCommodity: commodity }),
  clearError: () => set({ error: null }),
}));
