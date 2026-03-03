"use client";

import { useState } from "react";
import { useBudgetStore } from "@/store/budgetStore";
import type { BudgetLineItem } from "@/types/budget";

interface ForecastUpdateGridProps {
  periodId: string;
  items: BudgetLineItem[];
  userId: string;
  onDone: () => void;
}

interface ForecastRow {
  budgetMonth: string;
  forecastVolume: string;
  forecastPrice: string;
  budgetedVolume: number;
  budgetPrice: number | null;
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const idx = parseInt(mo, 10) - 1;
  return `${MONTH_SHORT[idx] ?? mo} ${y.slice(2)}`;
}

export function ForecastUpdateGrid({ periodId, items, userId, onDone }: ForecastUpdateGridProps) {
  const { batchForecastUpdate } = useBudgetStore();

  const [rows, setRows] = useState<ForecastRow[]>(
    items.map((li) => ({
      budgetMonth: li.budget_month,
      forecastVolume: li.forecast_volume != null ? String(li.forecast_volume) : "",
      forecastPrice: li.forecast_price != null ? String(li.forecast_price) : "",
      budgetedVolume: Number(li.budgeted_volume),
      budgetPrice: li.budget_price,
    }))
  );
  const [sharedNote, setSharedNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (idx: number, field: keyof ForecastRow, value: string) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: value };
    setRows(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = rows
        .filter((r) => r.forecastVolume || r.forecastPrice)
        .map((r) => ({
          budgetMonth: r.budgetMonth,
          forecastVolume: r.forecastVolume ? Number(r.forecastVolume) : null,
          forecastPrice: r.forecastPrice ? Number(r.forecastPrice) : null,
        }));
      if (updates.length === 0) { setError("Enter at least one forecast value"); setSaving(false); return; }
      await batchForecastUpdate(periodId, updates, sharedNote, userId);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {/* Shared note */}
      <div className="space-y-1">
        <label className="text-xs text-muted">Update Note (applied to all changes)</label>
        <input
          type="text"
          value={sharedNote}
          onChange={(e) => setSharedNote(e.target.value)}
          className="w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
          placeholder="e.g. Q2 reforecast based on shipping delays"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tbl-border bg-tbl-header">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Vol</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Forecast Vol</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Budget Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Forecast Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.budgetMonth} className="border-b border-tbl-border hover:bg-row-hover">
                <td className="px-3 py-1.5 text-secondary">{fmtMonth(row.budgetMonth)}</td>
                <td className="px-3 py-1.5 text-right text-muted tabular-nums">{row.budgetedVolume.toLocaleString()}</td>
                <td className="px-3 py-1">
                  <input
                    type="number"
                    step="0.01"
                    value={row.forecastVolume}
                    onChange={(e) => updateRow(i, "forecastVolume", e.target.value)}
                    className="w-full text-right border border-b-input bg-input-bg rounded px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                    placeholder={String(row.budgetedVolume)}
                  />
                </td>
                <td className="px-3 py-1.5 text-right text-muted tabular-nums">
                  {row.budgetPrice != null ? Number(row.budgetPrice).toFixed(4) : "—"}
                </td>
                <td className="px-3 py-1">
                  <input
                    type="number"
                    step="0.0001"
                    value={row.forecastPrice}
                    onChange={(e) => updateRow(i, "forecastPrice", e.target.value)}
                    className="w-full text-right border border-b-input bg-input-bg rounded px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                    placeholder={row.budgetPrice != null ? String(row.budgetPrice) : "—"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-4 py-2 text-sm text-faint hover:text-secondary transition-colors">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Update Forecasts"}
        </button>
      </div>
    </div>
  );
}
