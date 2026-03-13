import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type { CoverageSiteEntry, PositionByMonthDataPoint, DrillPathEntry, DrillLevel, WidgetLayoutEntry, UnitSummary, SiteSummary } from "@/types/dashboard";
import type { CoverageSummary } from "@/types/budget";
import type { HedgeBookEntry, RolloverCandidate } from "@/types/positions";
import type { FinancialTrade } from "@/types/trades";

interface HedgeBookKPIs {
  totalAllocations: number;
  openVolume: number;
  lockedVolume: number;
  offsetVolume: number;
  rolledVolume: number;
  openCount: number;
  efpCount: number;
}

interface RollSummary {
  total: number;
  critical: number;
  urgent: number;
}

export interface DashboardSummary {
  coverageBySite: CoverageSiteEntry[];
  positionsByMonth: PositionByMonthDataPoint[];
  coverage: CoverageSummary | null;
  hedgeBook: { entries: HedgeBookEntry[]; kpis: HedgeBookKPIs } | null;
  rollCandidates: { candidates: RolloverCandidate[]; summary: RollSummary } | null;
  trades: FinancialTrade[];
  pendingApproval: number;
}

interface DashboardState {
  // Data
  summary: DashboardSummary | null;
  // Legacy (kept for backward compat with useDashboardData hook)
  coverageBySite: CoverageSiteEntry[];
  positionsByMonth: PositionByMonthDataPoint[];

  // Drill-down state
  drillPath: DrillPathEntry[];
  drillLevel: DrillLevel;

  // Widget layout
  layout: WidgetLayoutEntry[];
  layoutLoading: boolean;

  // Unit/site summaries for drill-down cards
  unitSummaries: UnitSummary[];
  siteSummaries: SiteSummary[];
  summariesLoading: boolean;

  // UI
  loading: boolean;
  error: string | null;

  // Actions
  fetchDashboardData: (orgId: string, commodityId?: string, orgUnitId?: string) => Promise<void>;
  fetchDashboardSummary: (orgId: string, commodityId?: string, orgUnitId?: string) => Promise<void>;

  // Drill-down actions
  drillDown: (entry: DrillPathEntry) => void;
  drillTo: (index: number) => void;
  resetDrill: () => void;

  // Layout actions
  fetchLayout: (orgId: string) => Promise<void>;
  saveLayout: (orgId: string, layout: WidgetLayoutEntry[]) => Promise<void>;
  resetLayout: (orgId: string) => Promise<void>;

  // Summary actions
  fetchUnitSummaries: (orgId: string, commodityId?: string) => Promise<void>;
  fetchSiteSummaries: (orgId: string, unitId: string, commodityId?: string) => Promise<void>;

  clearError: () => void;
}

function computeDrillLevel(path: DrillPathEntry[]): DrillLevel {
  if (path.length === 0) return "corporate";
  const last = path[path.length - 1];
  return last.type === "unit" ? "unit" : last.type === "site" ? "site" : "corporate";
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  summary: null,
  coverageBySite: [],
  positionsByMonth: [],
  drillPath: [],
  drillLevel: "corporate",
  layout: [],
  layoutLoading: false,
  unitSummaries: [],
  siteSummaries: [],
  summariesLoading: false,
  loading: false,
  error: null,

  fetchDashboardData: async (orgId, commodityId, orgUnitId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      if (orgUnitId) params.set("orgUnitId", orgUnitId);
      const res = await fetch(`${API_BASE}/api/dashboard/data?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      set({
        coverageBySite: data.coverageBySite,
        positionsByMonth: data.positionsByMonth,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchDashboardSummary: async (orgId, commodityId, orgUnitId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId, full: "1" });
      if (commodityId) params.set("commodityId", commodityId);
      if (orgUnitId) params.set("orgUnitId", orgUnitId);
      const res = await fetch(`${API_BASE}/api/dashboard/data?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data: DashboardSummary = await res.json();
      set({
        summary: data,
        coverageBySite: data.coverageBySite,
        positionsByMonth: data.positionsByMonth,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  // ─── Drill-down ──────────────────────────────────────────────────────
  drillDown: (entry) => {
    const prev = get().drillPath;
    // Prevent duplicate entries (e.g. double-click)
    if (prev.length > 0 && prev[prev.length - 1].id === entry.id) return;
    const path = [...prev, entry];
    set({ drillPath: path, drillLevel: computeDrillLevel(path) });
  },

  drillTo: (index) => {
    const path = get().drillPath.slice(0, index);
    set({ drillPath: path, drillLevel: computeDrillLevel(path) });
  },

  resetDrill: () => {
    set({ drillPath: [], drillLevel: "corporate" });
  },

  // ─── Layout ──────────────────────────────────────────────────────────
  fetchLayout: async (orgId) => {
    set({ layoutLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/layout?orgId=${orgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const layout = await res.json();
      set({ layout, layoutLoading: false });
    } catch (err) {
      console.error("[dashboardStore] fetchLayout error:", err);
      set({ layoutLoading: false });
    }
  },

  saveLayout: async (orgId, layout) => {
    set({ layout });
    try {
      await fetch(`${API_BASE}/api/dashboard/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, layout }),
      });
    } catch (err) {
      console.error("[dashboardStore] saveLayout error:", err);
    }
  },

  resetLayout: async (orgId) => {
    try {
      await fetch(`${API_BASE}/api/dashboard/layout?orgId=${orgId}`, { method: "DELETE" });
      // Re-fetch to get default
      await get().fetchLayout(orgId);
    } catch (err) {
      console.error("[dashboardStore] resetLayout error:", err);
    }
  },

  // ─── Summaries ───────────────────────────────────────────────────────
  fetchUnitSummaries: async (orgId, commodityId) => {
    set({ summariesLoading: true });
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      const res = await fetch(`${API_BASE}/api/dashboard/unit-summary?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      set({ unitSummaries: await res.json(), summariesLoading: false });
    } catch (err) {
      console.error("[dashboardStore] fetchUnitSummaries error:", err);
      set({ summariesLoading: false });
    }
  },

  fetchSiteSummaries: async (orgId, unitId, commodityId) => {
    set({ summariesLoading: true });
    try {
      const params = new URLSearchParams({ orgId, unitId });
      if (commodityId) params.set("commodityId", commodityId);
      const res = await fetch(`${API_BASE}/api/dashboard/site-summary?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      set({ siteSummaries: await res.json(), summariesLoading: false });
    } catch (err) {
      console.error("[dashboardStore] fetchSiteSummaries error:", err);
      set({ summariesLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
