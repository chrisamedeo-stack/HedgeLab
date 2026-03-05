import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type { DashboardLayout, CoverageSiteEntry, PositionByMonthDataPoint } from "@/types/dashboard";

interface DashboardState {
  // Data
  dashboards: DashboardLayout[];
  coverageBySite: CoverageSiteEntry[];
  positionsByMonth: PositionByMonthDataPoint[];

  // UI
  loading: boolean;
  error: string | null;

  // Actions
  fetchDashboards: (userId: string, orgId: string) => Promise<void>;
  fetchDashboardData: (orgId: string, commodityId?: string) => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  dashboards: [],
  coverageBySite: [],
  positionsByMonth: [],
  loading: false,
  error: null,

  fetchDashboards: async (userId, orgId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ userId, orgId });
      const res = await fetch(`${API_BASE}/api/dashboard?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const dashboards = await res.json();
      set({ dashboards, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchDashboardData: async (orgId, commodityId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
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

  clearError: () => set({ error: null }),
}));
