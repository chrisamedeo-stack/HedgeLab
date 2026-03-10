"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import type { BudgetLineItem } from "@/types/budget";
import { useBudgetStore } from "@/store/budgetStore";
import { ForecastSparkline } from "./ForecastSparkline";
import { ForecastHistory } from "./ForecastHistory";

interface ForecastTabProps {
  periodId: string;
  items: BudgetLineItem[];
  userId: string;
  locked?: boolean;
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const idx = parseInt(mo, 10) - 1;
  return `${MONTH_SHORT[idx] ?? mo} ${y.slice(2)}`;
}

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function varianceColor(variance: number): string {
  if (variance > 0) return "text-profit";
  if (variance < 0) return "text-loss";
  return "text-muted";
}

export function ForecastTab({ periodId, items, userId, locked }: ForecastTabProps) {
  const { upsertLineItem, fetchForecastHistory, forecastHistory } = useBudgetStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVol, setEditVol] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch forecast history for all items on mount
  useEffect(() => {
    items.forEach((li) => {
      if (!forecastHistory[li.id]) {
        fetchForecastHistory(periodId, li.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, periodId, fetchForecastHistory]);

  const overHedgedCount = useMemo(() => {
    return items.filter((li) => li.over_hedged).length;
  }, [items]);

  const totals = useMemo(() => {
    let forecastVol = 0;
    let budgetVol = 0;
    let hedgedVol = 0;
    items.forEach((li) => {
      const fv = li.forecast_volume != null ? Number(li.forecast_volume) : Number(li.budgeted_volume);
      forecastVol += fv;
      budgetVol += Number(li.budgeted_volume);
      hedgedVol += Number(li.hedged_volume);
    });
    return { forecastVol, budgetVol, hedgedVol };
  }, [items]);

  const hedgeCoveragePct = totals.forecastVol > 0
    ? (totals.hedgedVol / totals.forecastVol) * 100
    : 0;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (li: BudgetLineItem) => {
    setEditingId(li.id);
    setEditVol(li.forecast_volume != null ? String(li.forecast_volume) : "");
    setEditPrice(li.forecast_price != null ? String(li.forecast_price) : "");
  };

  const saveEdit = async (li: BudgetLineItem) => {
    await upsertLineItem(periodId, {
      budgetMonth: li.budget_month,
      forecastVolume: editVol ? Number(editVol) : null,
      forecastPrice: editPrice ? Number(editPrice) : null,
      userId,
    });
    setEditingId(null);
    // Refresh history for this item
    fetchForecastHistory(periodId, li.id);
  };

  const colCount = locked ? 10 : 11;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Forecast Volume</div>
          <div className="text-lg font-semibold text-primary tabular-nums">{fmt(totals.forecastVol)}</div>
        </div>
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Forecast vs Budget</div>
          <div className={`text-lg font-semibold tabular-nums ${varianceColor(totals.forecastVol - totals.budgetVol)}`}>
            {totals.forecastVol - totals.budgetVol > 0 ? "+" : ""}{fmt(totals.forecastVol - totals.budgetVol)}
          </div>
        </div>
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Hedge Coverage</div>
          <div className={`text-lg font-semibold tabular-nums ${
            hedgeCoveragePct >= 100 ? "text-profit" : hedgeCoveragePct >= 50 ? "text-action" : "text-muted"
          }`}>
            {hedgeCoveragePct.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Over-hedged</div>
          <div className={`text-lg font-semibold tabular-nums ${overHedgedCount > 0 ? "text-warning" : "text-muted"}`}>
            {overHedgedCount}
          </div>
        </div>
      </div>

      {/* Forecast table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tbl-border bg-tbl-header">
              <th className="px-1 py-2 w-8" />
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Vol</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Forecast Vol</th>
              <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted w-20">Trend</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Variance</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Hedged Vol</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Coverage %</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Forecast Price</th>
              {!locked && <th className="px-3 py-2 w-16" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-faint">No line items to forecast against.</td>
              </tr>
            ) : (
              items.map((li) => {
                const fv = li.forecast_volume != null ? Number(li.forecast_volume) : null;
                const bv = Number(li.budgeted_volume);
                const volVariance = fv != null ? fv - bv : null;
                const hv = Number(li.hedged_volume);
                const effectiveVol = fv ?? bv;
                const covPct = effectiveVol > 0 ? (hv / effectiveVol) * 100 : 0;
                const isEditing = editingId === li.id;
                const isExpanded = expandedIds.has(li.id);
                const history = forecastHistory[li.id] ?? [];

                return (
                  <Fragment key={li.id}>
                    <tr className="border-b border-tbl-border hover:bg-row-hover transition-colors">
                      <td className="px-1 py-2 text-center">
                        <button
                          onClick={() => toggleExpand(li.id)}
                          className="text-muted hover:text-secondary transition-colors text-xs"
                        >
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-secondary">{fmtMonth(li.budget_month)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(bv)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editVol}
                            onChange={(e) => setEditVol(e.target.value)}
                            className="w-24 text-right border border-b-input bg-input-bg rounded px-2 py-0.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                            autoFocus
                          />
                        ) : (
                          fmt(fv)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          <ForecastSparkline history={history} />
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${volVariance != null ? varianceColor(volVariance) : "text-muted"}`}>
                        {volVariance != null ? `${volVariance > 0 ? "+" : ""}${fmt(volVariance)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(hv)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                        covPct >= 100 ? "text-profit" : covPct >= 50 ? "text-action" : "text-muted"
                      }`}>
                        <span className="flex items-center justify-end gap-1.5">
                          {covPct.toFixed(1)}%
                          {li.over_hedged && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-warning-10 ring-1 ring-warning-30 text-warning text-xs font-medium">
                              Over
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt(li.budget_price)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.0001"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-24 text-right border border-b-input bg-input-bg rounded px-2 py-0.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                          />
                        ) : (
                          fmt(li.forecast_price)
                        )}
                      </td>
                      {!locked && (
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => saveEdit(li)} className="text-xs text-profit hover:text-profit-hover">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-muted hover:text-secondary">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(li)} className="text-xs text-muted hover:text-secondary transition-colors">Edit</button>
                          )}
                        </td>
                      )}
                    </tr>
                    {/* Expanded forecast history */}
                    {isExpanded && (
                      <tr className="border-b border-tbl-border">
                        <td colSpan={colCount} className="px-6 py-3 bg-main/40 border-t border-b-default/50">
                          <ForecastHistory periodId={periodId} lineItemId={li.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
