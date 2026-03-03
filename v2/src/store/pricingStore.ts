import { create } from "zustand";
import type { FormulaRow, RateTable, FormulaTemplate, EvaluationResult } from "@/types/pricing";
import type { FormulaComponent } from "@/lib/pricingEngine";

interface PricingState {
  formulas: FormulaRow[];
  rateTables: RateTable[];
  templates: FormulaTemplate[];
  loading: boolean;
  error: string | null;

  fetchFormulas: (orgId: string, commodityId?: string) => Promise<void>;
  createFormula: (params: {
    orgId: string; name: string; description?: string; commodityId?: string;
    formulaType: string; components: FormulaComponent[];
    outputUnit?: string; rounding?: number;
  }) => Promise<FormulaRow>;
  updateFormula: (id: string, params: {
    name?: string; description?: string; commodityId?: string | null;
    formulaType?: string; components?: FormulaComponent[];
    outputUnit?: string | null; rounding?: number; isActive?: boolean;
  }) => Promise<FormulaRow>;
  deleteFormula: (id: string) => Promise<void>;
  duplicateFormula: (id: string, orgId: string) => Promise<FormulaRow>;

  fetchRateTables: (orgId: string, commodityId?: string) => Promise<void>;
  createRateTable: (params: {
    orgId: string; name: string; rateType: string;
    commodityId?: string; rates: Record<string, number>;
    effectiveDate?: string; expiryDate?: string;
  }) => Promise<RateTable>;
  updateRateTable: (id: string, params: {
    name?: string; rateType?: string; commodityId?: string | null;
    rates?: Record<string, number>;
    effectiveDate?: string | null; expiryDate?: string | null;
    isActive?: boolean;
  }) => Promise<RateTable>;
  deleteRateTable: (id: string) => Promise<void>;

  evaluateFormula: (formulaId: string, context: {
    inputs: Record<string, number>;
    marketPrices?: Record<string, number>;
    fxRates?: Record<string, number>;
    rateTables?: Record<string, Record<string, number>>;
  }) => Promise<EvaluationResult>;

  fetchTemplates: () => Promise<void>;
  instantiateTemplate: (templateId: string, orgId: string, commodityId?: string) => Promise<FormulaRow>;

  clearError: () => void;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const usePricingStore = create<PricingState>((set, get) => ({
  formulas: [],
  rateTables: [],
  templates: [],
  loading: false,
  error: null,

  fetchFormulas: async (orgId, commodityId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      const data = await api(`/api/kernel/pricing?${params}`);
      set({ formulas: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createFormula: async (params) => {
    set({ loading: true, error: null });
    try {
      const formula = await api("/api/kernel/pricing", {
        method: "POST",
        body: JSON.stringify(params),
      });
      set((s) => ({ formulas: [...s.formulas, formula], loading: false }));
      return formula;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateFormula: async (id, params) => {
    set({ error: null });
    try {
      const formula = await api("/api/kernel/pricing", {
        method: "PUT",
        body: JSON.stringify({ id, ...params }),
      });
      set((s) => ({
        formulas: s.formulas.map((f) => (f.id === id ? formula : f)),
      }));
      return formula;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  deleteFormula: async (id) => {
    set({ error: null });
    try {
      await api(`/api/kernel/pricing?id=${id}`, { method: "DELETE" });
      set((s) => ({ formulas: s.formulas.filter((f) => f.id !== id) }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  duplicateFormula: async (id, orgId) => {
    const existing = get().formulas.find((f) => f.id === id);
    if (!existing) throw new Error("Formula not found");
    const formula = await get().createFormula({
      orgId,
      name: `${existing.name} (Copy)`,
      description: existing.description ?? undefined,
      commodityId: existing.commodity_id ?? undefined,
      formulaType: existing.formula_type,
      components: existing.components,
      outputUnit: existing.output_unit ?? undefined,
      rounding: existing.rounding,
    });
    return formula;
  },

  fetchRateTables: async (orgId, commodityId) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ orgId });
      if (commodityId) params.set("commodityId", commodityId);
      const data = await api(`/api/kernel/pricing/rate-tables?${params}`);
      set({ rateTables: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createRateTable: async (params) => {
    set({ loading: true, error: null });
    try {
      const table = await api("/api/kernel/pricing/rate-tables", {
        method: "POST",
        body: JSON.stringify(params),
      });
      set((s) => ({ rateTables: [...s.rateTables, table], loading: false }));
      return table;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateRateTable: async (id, params) => {
    set({ error: null });
    try {
      const table = await api(`/api/kernel/pricing/rate-tables/${id}`, {
        method: "PUT",
        body: JSON.stringify(params),
      });
      set((s) => ({
        rateTables: s.rateTables.map((t) => (t.id === id ? table : t)),
      }));
      return table;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  deleteRateTable: async (id) => {
    set({ error: null });
    try {
      await api(`/api/kernel/pricing/rate-tables/${id}`, { method: "DELETE" });
      set((s) => ({ rateTables: s.rateTables.filter((t) => t.id !== id) }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  evaluateFormula: async (formulaId, context) => {
    set({ error: null });
    try {
      const result = await api("/api/kernel/pricing", {
        method: "POST",
        body: JSON.stringify({ action: "evaluate", formulaId, ...context }),
      });
      return result;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  fetchTemplates: async () => {
    set({ error: null });
    try {
      const data = await api("/api/kernel/pricing/templates");
      set({ templates: data });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  instantiateTemplate: async (templateId, orgId, commodityId) => {
    set({ loading: true, error: null });
    try {
      const formula = await api("/api/kernel/pricing/templates", {
        method: "POST",
        body: JSON.stringify({ templateId, orgId, commodityId }),
      });
      set((s) => ({ formulas: [...s.formulas, formula], loading: false }));
      return formula;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
