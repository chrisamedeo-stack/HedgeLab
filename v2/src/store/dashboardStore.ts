import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  NavState,
  DashboardKpis,
  DashboardAlert,
  ChildSummary,
  SiteOperationalData,
  CoverageSiteEntry,
  PositionByMonthDataPoint,
} from "@/types/dashboard";

interface DashboardState {
  // Navigation
  nav: NavState;
  setNav: (nav: NavState) => void;

  // Data
  kpis: DashboardKpis | null;
  alerts: DashboardAlert[];
  children: ChildSummary[];
  operational: SiteOperationalData | null;
  coverageBySite: CoverageSiteEntry[];
  positionsByMonth: PositionByMonthDataPoint[];

  // UI
  loading: boolean;
  error: string | null;

  // Actions
  fetchDashboard: (nav: NavState) => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  nav: { level: "corporate" },
  setNav: (nav) => set({ nav }),

  kpis: null,
  alerts: [],
  children: [],
  operational: null,
  coverageBySite: [],
  positionsByMonth: [],

  loading: false,
  error: null,

  fetchDashboard: async (nav) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ level: nav.level });
      if (nav.orgUnitId) params.set("orgUnitId", nav.orgUnitId);
      if (nav.siteId) params.set("siteId", nav.siteId);
      if (nav.commodityId) params.set("commodityId", nav.commodityId);

      const res = await fetch(`${API_BASE}/api/dashboard/data?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();

      set({
        kpis: data.kpis ?? null,
        alerts: data.alerts ?? [],
        children: data.children ?? [],
        operational: data.operational ?? null,
        coverageBySite: data.coverageBySite ?? [],
        positionsByMonth: data.positionsByMonth ?? [],
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
