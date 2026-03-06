"use client";

import { useState, useEffect, useCallback } from "react";
import { useBudgetStore } from "@/store/budgetStore";
import { useOrgContext } from "@/contexts/OrgContext";
import { usePricingStore } from "@/store/pricingStore";
import { ComponentEditor } from "./ComponentEditor";
import { suggestFuturesMonth, type CommodityConfig } from "@/lib/commodity-utils";
import type { BudgetComponent } from "@/types/budget";
import type { FormulaComponent, EvaluationResult } from "@/lib/pricingEngine";

interface BudgetLineFormProps {
  periodId: string;
  userId: string;
  onClose: () => void;
  commodity?: CommodityConfig | null;
  commodityId?: string;
  existing?: {
    budgetMonth: string;
    budgetedVolume: number;
    budgetPrice: number | null;
    forecastVolume: number | null;
    forecastPrice: number | null;
    futuresMonth: string | null;
    components: BudgetComponent[];
    notes: string | null;
    formulaId?: string | null;
    formulaInputs?: Record<string, number> | null;
    formulaPrice?: number | null;
  };
}

export function BudgetLineForm({ periodId, userId, onClose, commodity, commodityId, existing }: BudgetLineFormProps) {
  const { upsertLineItem } = useBudgetStore();
  const { orgId, isPluginEnabled } = useOrgContext();
  const { formulas, fetchFormulas, evaluateFormula } = usePricingStore();
  const formulaEnabled = isPluginEnabled("formula_pricing");

  const [form, setForm] = useState({
    budgetMonth: existing?.budgetMonth ?? "",
    budgetedVolume: existing?.budgetedVolume ?? 0,
    budgetPrice: existing?.budgetPrice ?? null as number | null,
    forecastVolume: existing?.forecastVolume ?? null as number | null,
    forecastPrice: existing?.forecastPrice ?? null as number | null,
    futuresMonth: existing?.futuresMonth ?? "" as string,
    notes: existing?.notes ?? "",
    formulaId: existing?.formulaId ?? "" as string,
  });
  const [components, setComponents] = useState<BudgetComponent[]>(existing?.components ?? []);
  const [formulaInputs, setFormulaInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (existing?.formulaInputs) {
      for (const [k, v] of Object.entries(existing.formulaInputs)) {
        initial[k] = String(v);
      }
    }
    return initial;
  });
  const [formulaResult, setFormulaResult] = useState<EvaluationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch formulas when formula pricing is enabled
  useEffect(() => {
    if (formulaEnabled) {
      fetchFormulas(orgId, commodityId);
    }
  }, [formulaEnabled, orgId, commodityId, fetchFormulas]);

  // Sync component all-in total → budgetPrice (unless a formula is driving the price)
  const handleComponentsChange = useCallback((updated: BudgetComponent[]) => {
    setComponents(updated);
    if (!form.formulaId && updated.length > 0) {
      let baseTotal = 0;
      let pctMultiplier = 1;
      for (const c of updated) {
        if (c.unit === "%") {
          pctMultiplier *= 1 + Number(c.target_value || 0) / 100;
        } else {
          baseTotal += Number(c.target_value || 0);
        }
      }
      const allIn = baseTotal * pctMultiplier;
      setForm((f) => ({ ...f, budgetPrice: allIn || null }));
    }
  }, [form.formulaId]);

  const selectedFormula = formulas.find((f) => f.id === form.formulaId);
  const editableComponents = selectedFormula?.components
    ?.filter((c: FormulaComponent) => c.type === "input" || c.type === "market_ref")
    ?.sort((a: FormulaComponent, b: FormulaComponent) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) ?? [];

  const handleMonthChange = (budgetMonth: string) => {
    const suggested = suggestFuturesMonth(commodity ?? null, budgetMonth);
    setForm({ ...form, budgetMonth, futuresMonth: suggested || form.futuresMonth });
  };

  const handleCalculate = async () => {
    if (!form.formulaId) return;
    setCalculating(true);
    setError(null);
    try {
      const inputs: Record<string, number> = {};
      for (const [k, v] of Object.entries(formulaInputs)) {
        inputs[k] = Number(v) || 0;
      }
      const result = await evaluateFormula(form.formulaId, { inputs });
      setFormulaResult(result);
      if (result.totalPrice !== undefined) {
        setForm((f) => ({ ...f, budgetPrice: result.totalPrice }));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.budgetMonth) { setError("Budget month is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const numInputs: Record<string, number> = {};
      for (const [k, v] of Object.entries(formulaInputs)) {
        numInputs[k] = Number(v) || 0;
      }

      await upsertLineItem(periodId, {
        ...form,
        futuresMonth: form.futuresMonth || null,
        formulaId: form.formulaId || null,
        formulaInputs: Object.keys(numInputs).length > 0 ? numInputs : null,
        formulaPrice: formulaResult?.totalPrice ?? existing?.formulaPrice ?? null,
        components: components.length > 0 ? components : undefined,
        userId,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted">Budget Month</label>
          <input
            type="month"
            value={form.budgetMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className={inputCls}
            disabled={!!existing}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Futures Month</label>
          <input
            type="text"
            value={form.futuresMonth}
            onChange={(e) => setForm({ ...form, futuresMonth: e.target.value })}
            className={inputCls}
            placeholder="e.g. ZCH26"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted">Budgeted Volume (MT)</label>
          <input
            type="number"
            step="0.01"
            value={form.budgetedVolume}
            onChange={(e) => setForm({ ...form, budgetedVolume: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Budget Price</label>
          <input
            type="number"
            step="0.0001"
            value={form.budgetPrice ?? ""}
            onChange={(e) => setForm({ ...form, budgetPrice: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
            placeholder="Optional"
            readOnly={!!formulaResult || (components.length > 0 && !form.formulaId)}
          />
        </div>
      </div>

      {/* Formula pricing section */}
      {formulaEnabled && (
        <div className="space-y-2 rounded-lg border border-action-30 bg-action-5 p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-action">Formula Price (optional)</label>
            <select
              value={form.formulaId}
              onChange={(e) => { setForm({ ...form, formulaId: e.target.value }); setFormulaResult(null); setFormulaInputs({}); }}
              className={inputCls}
            >
              <option value="">No formula</option>
              {formulas.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {selectedFormula && editableComponents.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {editableComponents.map((comp: FormulaComponent) => (
                <div key={comp.id} className="space-y-1">
                  <label className="text-xs text-muted">{comp.label} {comp.unit ? `(${comp.unit})` : ""}</label>
                  <input
                    type="number"
                    step="any"
                    value={formulaInputs[comp.id] ?? ""}
                    onChange={(e) => { setFormulaInputs((prev) => ({ ...prev, [comp.id]: e.target.value })); setFormulaResult(null); }}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          {selectedFormula && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCalculate}
                disabled={calculating}
                className="rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-action-hover disabled:opacity-50"
              >
                {calculating ? "Calculating..." : "Calculate"}
              </button>
              {formulaResult && (
                <span className="text-sm font-medium text-profit">
                  = {formulaResult.totalPrice?.toFixed(selectedFormula.rounding ?? 4)} {selectedFormula.output_unit ?? ""}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted">Forecast Volume (MT)</label>
          <input
            type="number"
            step="0.01"
            value={form.forecastVolume ?? ""}
            onChange={(e) => setForm({ ...form, forecastVolume: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Forecast Price</label>
          <input
            type="number"
            step="0.0001"
            value={form.forecastPrice ?? ""}
            onChange={(e) => setForm({ ...form, forecastPrice: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Cost Components */}
      <div className="space-y-1">
        <label className="text-xs text-muted">Cost Components</label>
        <div className="border border-b-input rounded-lg p-3 bg-surface/30">
          <ComponentEditor components={components} onChange={handleComponentsChange} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className={`${inputCls} h-16 resize-none`}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-faint hover:text-secondary transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : existing ? "Update" : "Add Month"}
        </button>
      </div>
    </form>
  );
}
