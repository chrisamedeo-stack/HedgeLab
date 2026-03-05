import { create } from "zustand";
import { API_BASE } from "@/lib/api";
import type {
  FctScenario,
  FctScenarioResult,
  CreateScenarioParams,
  ScenarioFilters,
} from "@/types/forecast";

interface ForecastState {
  // Data
  scenarios: FctScenario[];
  activeScenario: FctScenario | null;
  activeResults: FctScenarioResult[];
  // UI
  loading: boolean;
  running: boolean;
  error: string | null;

  // Actions
  fetchScenarios: (orgId: string, filters?: ScenarioFilters) => Promise<void>;
  fetchScenario: (scenarioId: string) => Promise<void>;
  createScenario: (params: CreateScenarioParams) => Promise<FctScenario>;
  runScenario: (scenarioId: string, userId: string) => Promise<void>;
  deleteScenario: (scenarioId: string, userId: string) => Promise<void>;
  cloneScenario: (scenarioId: string, userId: string) => Promise<FctScenario>;
  clearError: () => void;
}

export const useForecastStore = create<ForecastState>((set, get) => ({
  scenarios: [],
  activeScenario: null,
  activeResults: [],
  loading: false,
  running: false,
  error: null,

  fetchScenarios: async (orgId, filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (filters?.scenarioType) params.set("scenarioType", filters.scenarioType);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.baseCommodity) params.set("baseCommodity", filters.baseCommodity);
      const res = await fetch(`${API_BASE}/api/forecast?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const scenarios = await res.json();
      set({ scenarios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchScenario: async (scenarioId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/forecast/${scenarioId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const scenario: FctScenario = await res.json();
      set({
        activeScenario: scenario,
        activeResults: scenario.result_rows ?? [],
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createScenario: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const scenario: FctScenario = await res.json();
      set((s) => ({ scenarios: [scenario, ...s.scenarios], loading: false }));
      return scenario;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  runScenario: async (scenarioId, userId) => {
    set({ running: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/forecast/${scenarioId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // Refresh the scenario to get results
      await get().fetchScenario(scenarioId);
      // Update in list too
      set((s) => ({
        scenarios: s.scenarios.map((sc) =>
          sc.id === scenarioId ? { ...sc, status: "completed" as const } : sc
        ),
        running: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, running: false });
      throw err;
    }
  },

  deleteScenario: async (scenarioId, userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/forecast/${scenarioId}?userId=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      set((s) => ({
        scenarios: s.scenarios.filter((sc) => sc.id !== scenarioId),
        activeScenario: s.activeScenario?.id === scenarioId ? null : s.activeScenario,
        activeResults: s.activeScenario?.id === scenarioId ? [] : s.activeResults,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  cloneScenario: async (scenarioId, userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/forecast/${scenarioId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const scenario: FctScenario = await res.json();
      set((s) => ({ scenarios: [scenario, ...s.scenarios] }));
      return scenario;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
