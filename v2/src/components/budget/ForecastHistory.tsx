"use client";

import { useState, useEffect } from "react";
import { useBudgetStore } from "@/store/budgetStore";
import type { ForecastHistoryEntry } from "@/types/budget";

interface ForecastHistoryProps {
  periodId: string;
  lineItemId: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function fmtVol(n: number | null): string {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ForecastHistory({ periodId, lineItemId }: ForecastHistoryProps) {
  const { fetchForecastHistory, forecastHistory } = useBudgetStore();
  const [benchmarkIdx, setBenchmarkIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchForecastHistory(periodId, lineItemId);
  }, [fetchForecastHistory, periodId, lineItemId]);

  const history = forecastHistory[lineItemId] ?? [];
  const visible = showAll ? history : history.slice(0, 10);
  const benchmark = history[benchmarkIdx] ?? null;

  if (history.length === 0) {
    return <div className="py-4 text-center text-xs text-faint">No forecast history</div>;
  }

  return (
    <div className="space-y-2">
      {/* Benchmark selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted">Benchmark:</label>
        <select
          value={benchmarkIdx}
          onChange={(e) => setBenchmarkIdx(Number(e.target.value))}
          className="text-xs border border-b-input bg-input-bg rounded px-2 py-0.5 text-primary focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value={0}>Latest</option>
          {history.map((h, i) => (
            <option key={h.id} value={i}>
              {fmtDate(h.recorded_at)} — {fmtVol(h.forecast_volume)}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            <th className="text-left py-1 font-medium">Date</th>
            <th className="text-left py-1 font-medium">By</th>
            <th className="text-right py-1 font-medium">Volume</th>
            <th className="text-right py-1 font-medium">Price</th>
            <th className="text-right py-1 font-medium">vs Benchmark</th>
            <th className="text-left py-1 pl-3 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((h, i) => {
            const delta =
              benchmark && h.forecast_volume != null && benchmark.forecast_volume != null
                ? Number(h.forecast_volume) - Number(benchmark.forecast_volume)
                : null;
            const isSelected = i === benchmarkIdx;

            return (
              <tr
                key={h.id}
                className={`border-t border-tbl-border ${isSelected ? "bg-action/5 border-l-2 border-l-action" : ""}`}
              >
                <td className="py-1 text-faint">{fmtDate(h.recorded_at)}</td>
                <td className="py-1 text-muted truncate max-w-[80px]">{h.recorded_by ?? "—"}</td>
                <td className="py-1 text-right tabular-nums">{fmtVol(h.forecast_volume)}</td>
                <td className="py-1 text-right tabular-nums text-muted">{fmtVol(h.forecast_price)}</td>
                <td className={`py-1 text-right tabular-nums ${
                  delta != null ? (delta > 0 ? "text-profit" : delta < 0 ? "text-loss" : "text-muted") : "text-muted"
                }`}>
                  {delta != null ? `${delta > 0 ? "+" : ""}${fmtVol(delta)}` : "—"}
                </td>
                <td className="py-1 pl-3 text-faint truncate max-w-[120px]">{h.notes ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {history.length > 10 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-action hover:text-action-hover transition-colors"
        >
          Show all {history.length} entries
        </button>
      )}
    </div>
  );
}
