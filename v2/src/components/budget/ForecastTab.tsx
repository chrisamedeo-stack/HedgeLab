"use client";

import { useState } from "react";
import type { BudgetLineItem } from "@/types/budget";
import { useBudgetStore } from "@/store/budgetStore";

interface ForecastTabProps {
  periodId: string;
  items: BudgetLineItem[];
  userId: string;
  locked?: boolean;
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
  const { upsertLineItem } = useBudgetStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVol, setEditVol] = useState("");
  const [editPrice, setEditPrice] = useState("");

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
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tbl-border bg-tbl-header">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Vol</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Forecast Vol</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Variance</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Price</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Forecast Price</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Price Var</th>
            {!locked && <th className="px-3 py-2 w-16" />}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-faint">No line items to forecast against.</td>
            </tr>
          ) : (
            items.map((li) => {
              const fv = li.forecast_volume != null ? Number(li.forecast_volume) : null;
              const bv = Number(li.budgeted_volume);
              const volVariance = fv != null ? fv - bv : null;

              const fp = li.forecast_price != null ? Number(li.forecast_price) : null;
              const bp = li.budget_price != null ? Number(li.budget_price) : null;
              const priceVariance = fp != null && bp != null ? fp - bp : null;

              const isEditing = editingId === li.id;

              return (
                <tr key={li.id} className="border-b border-tbl-border hover:bg-row-hover transition-colors">
                  <td className="px-3 py-2 text-secondary">{li.budget_month}</td>
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
                  <td className={`px-3 py-2 text-right tabular-nums ${volVariance != null ? varianceColor(volVariance) : "text-muted"}`}>
                    {volVariance != null ? `${volVariance > 0 ? "+" : ""}${fmt(volVariance)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt(bp)}</td>
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
                      fmt(fp)
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${priceVariance != null ? varianceColor(-priceVariance) : "text-muted"}`}>
                    {priceVariance != null ? `${priceVariance > 0 ? "+" : ""}${fmt(priceVariance)}` : "—"}
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
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
