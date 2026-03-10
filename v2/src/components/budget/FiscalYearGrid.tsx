"use client";

import { useState } from "react";
import { useBudgetStore } from "@/store/budgetStore";
import { ComponentEditor } from "./ComponentEditor";
import { ComponentTokenBar } from "./ComponentTokenBar";
import { suggestFuturesMonth, type CommodityConfig } from "@/lib/commodity-utils";
import type { BudgetComponent } from "@/types/budget";

interface FiscalYearGridProps {
  periodId: string;
  budgetYear: number;
  userId: string;
  onDone: () => void;
  commodity?: CommodityConfig | null;
}

function generateMonths(year: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthRow {
  month: string;
  volume: number;
  price: string;
  futuresMonth: string;
  notes: string;
  componentOverrides: Record<string, number | null>;
}

export function FiscalYearGrid({ periodId, budgetYear, userId, onDone, commodity }: FiscalYearGridProps) {
  const { upsertLineItems } = useBudgetStore();
  const months = generateMonths(budgetYear);

  const [rows, setRows] = useState<MonthRow[]>(
    months.map((m) => ({
      month: m,
      volume: 0,
      price: "",
      futuresMonth: suggestFuturesMonth(commodity ?? null, m),
      notes: "",
      componentOverrides: {},
    }))
  );
  const [sharedPrice, setSharedPrice] = useState("");
  const [sharedComponents, setSharedComponents] = useState<BudgetComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const componentNames = sharedComponents.map((c) => c.component_name);

  const updateRow = (idx: number, field: keyof MonthRow, value: string | number) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: value };
    setRows(next);
  };

  const updateComponentOverride = (idx: number, name: string, value: string) => {
    const next = [...rows];
    const overrides = { ...next[idx].componentOverrides };
    if (value === "") {
      overrides[name] = null; // revert to shared default
    } else {
      overrides[name] = Number(value);
    }
    next[idx] = { ...next[idx], componentOverrides: overrides };
    setRows(next);
  };

  /** Resolve the value for a component in a given row */
  const resolveComponentValue = (row: MonthRow, name: string): number => {
    const override = row.componentOverrides[name];
    if (override != null) return override;
    const shared = sharedComponents.find((c) => c.component_name === name);
    return Number(shared?.target_value ?? 0);
  };

  /** Check if a cell is overridden from the shared default */
  const isOverridden = (row: MonthRow, name: string): boolean => {
    return row.componentOverrides[name] != null;
  };

  /** Compute All-In price for a row: budget_price + sum of all resolved components */
  const computeAllIn = (row: MonthRow): number => {
    const price = Number(row.price || 0);
    const compTotal = componentNames.reduce((sum, name) => sum + resolveComponentValue(row, name), 0);
    return price + compTotal;
  };

  const applySharedPrice = () => {
    if (!sharedPrice) return;
    setRows(rows.map((r) => ({ ...r, price: sharedPrice })));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const items = rows
        .filter((r) => r.volume > 0)
        .map((r) => {
          // Build per-row components: use overrides where set, shared defaults otherwise
          const rowComponents: BudgetComponent[] = sharedComponents.map((sc) => ({
            ...sc,
            target_value: resolveComponentValue(r, sc.component_name),
          }));

          return {
            budgetMonth: r.month,
            budgetedVolume: Number(r.volume),
            budgetPrice: r.price ? Number(r.price) : null,
            futuresMonth: r.futuresMonth || null,
            components: rowComponents.length > 0 ? rowComponents : undefined,
            notes: r.notes || null,
          };
        });

      if (items.length === 0) { setError("Enter at least one month with volume > 0"); setSaving(false); return; }
      await upsertLineItems(periodId, items, userId);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalVolume = rows.reduce((sum, r) => sum + Number(r.volume || 0), 0);
  const hasComponents = componentNames.length > 0;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {/* Shared price input */}
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted">Shared Budget Price</label>
          <input
            type="number"
            step="0.0001"
            value={sharedPrice}
            onChange={(e) => setSharedPrice(e.target.value)}
            className="w-40 border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
            placeholder="Apply to all"
          />
        </div>
        <button
          onClick={applySharedPrice}
          className="px-3 py-1.5 text-xs text-muted border border-b-input rounded-lg hover:bg-hover hover:text-secondary transition-colors"
        >
          Apply to All
        </button>
      </div>

      {/* Shared components */}
      <div className="space-y-1">
        <label className="text-xs text-muted">Shared Cost Components (applied to all months)</label>
        <div className="border border-b-input rounded-lg p-3 bg-surface/30">
          <ComponentEditor components={sharedComponents} onChange={setSharedComponents} commodity={commodity as import("@/hooks/usePositions").Commodity | null} />
        </div>
        {sharedComponents.length > 0 && (
          <div className="mt-1">
            <ComponentTokenBar components={sharedComponents} commodity={commodity as import("@/hooks/usePositions").Commodity | null} />
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tbl-border bg-tbl-header">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted w-24">Futures Ref</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Volume ({commodity?.volume_unit || "MT"})</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Price</th>
              {componentNames.map((name) => (
                <th key={name} className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">
                  {name}
                </th>
              ))}
              {hasComponents && (
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-action">All-In</th>
              )}
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Cost</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted w-28">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const allIn = hasComponents ? computeAllIn(row) : Number(row.price || 0);
              const cost = Number(row.volume || 0) * allIn;
              return (
                <tr key={row.month} className="border-b border-tbl-border hover:bg-row-hover">
                  <td className="px-3 py-1.5 text-secondary">{MONTH_LABELS[i]} {budgetYear}</td>
                  <td className="px-3 py-1.5 text-xs text-muted tabular-nums">
                    {row.futuresMonth || "—"}
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={row.volume || ""}
                      onChange={(e) => updateRow(i, "volume", Number(e.target.value))}
                      className="w-full text-right border border-b-input bg-input-bg rounded px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="number"
                      step="0.0001"
                      value={row.price}
                      onChange={(e) => updateRow(i, "price", e.target.value)}
                      className="w-full text-right border border-b-input bg-input-bg rounded px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                      placeholder="—"
                    />
                  </td>
                  {componentNames.map((name) => {
                    const overridden = isOverridden(row, name);
                    const resolved = resolveComponentValue(row, name);
                    return (
                      <td key={name} className="px-3 py-1">
                        <input
                          type="number"
                          step="0.0001"
                          value={overridden ? (row.componentOverrides[name] ?? "") : (resolved || "")}
                          onChange={(e) => updateComponentOverride(i, name, e.target.value)}
                          className={`w-full text-right border border-b-input bg-input-bg rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-focus ${
                            overridden ? "text-action font-semibold" : "text-primary"
                          }`}
                          placeholder={String(resolved || "—")}
                        />
                      </td>
                    );
                  })}
                  {hasComponents && (
                    <td className="px-3 py-1.5 text-right text-action font-medium tabular-nums">
                      {allIn > 0 ? allIn.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-right text-muted tabular-nums">
                    {cost > 0 ? cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(i, "notes", e.target.value)}
                      className="w-full border border-b-input bg-input-bg rounded px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                      placeholder="—"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-b-default bg-surface">
              <td className="px-3 py-2 text-xs font-medium text-muted">Total</td>
              <td />
              <td className="px-3 py-2 text-right text-sm font-semibold text-secondary tabular-nums">
                {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td />
              {componentNames.map((name) => (
                <td key={name} />
              ))}
              {hasComponents && <td />}
              <td className="px-3 py-2 text-right text-sm font-semibold text-secondary tabular-nums">
                {rows.reduce((s, r) => {
                  const allIn = hasComponents ? computeAllIn(r) : Number(r.price || 0);
                  return s + Number(r.volume || 0) * allIn;
                }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-4 py-2 text-sm text-faint hover:text-secondary transition-colors">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save All Months"}
        </button>
      </div>
    </div>
  );
}
