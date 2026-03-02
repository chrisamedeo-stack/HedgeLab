"use client";

import { useState } from "react";
import { ForecastHistoryDto } from "@/hooks/useCorn";
import { fmtVol, fmtDate } from "./shared";
import { cn } from "@/lib/utils";

interface Props {
  budgetLineId: number;
  history: ForecastHistoryDto[];
  benchmarkId: number | null;
  onBenchmarkChange: (id: number | null) => void;
}

export function ForecastHistoryTimeline({ budgetLineId, history, benchmarkId, onBenchmarkChange }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (history.length === 0) return null;

  const visible = showAll ? history : history.slice(0, 10);

  // Resolve benchmark: null means "latest" (first entry since history is newest-first)
  const benchmarkEntry = benchmarkId != null
    ? history.find((h) => h.id === benchmarkId)
    : history[0];
  const benchmarkBu = benchmarkEntry?.forecastBu ?? null;

  return (
    <div className="mt-3 pt-3 border-t border-b-default/50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-faint font-medium">Forecast History</p>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-faint uppercase tracking-wider">Benchmark:</label>
          <select
            value={benchmarkId ?? "latest"}
            onChange={(e) => {
              const val = e.target.value;
              onBenchmarkChange(val === "latest" ? null : Number(val));
            }}
            className="text-xs bg-input-bg border border-b-input rounded px-2 py-0.5 text-secondary focus:outline-none focus:ring-1 focus:ring-action"
          >
            <option value="latest">
              Latest ({history.length > 0 ? fmtDate(history[0].recordedAt) : ""})
            </option>
            {history.map((h) => (
              <option key={h.id} value={h.id}>
                {fmtDate(h.recordedAt)} — {fmtVol(h.forecastBu)} bu
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="rounded-lg border border-b-default overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-tbl-header">
              <th className="px-3 py-1.5 text-left text-faint font-medium">Date</th>
              <th className="px-3 py-1.5 text-left text-faint font-medium">By</th>
              <th className="px-3 py-1.5 text-right text-faint font-medium">Forecast Bu</th>
              <th className="px-3 py-1.5 text-right text-faint font-medium">vs Benchmark</th>
              <th className="px-3 py-1.5 text-left text-faint font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default/50">
            {visible.map((h) => {
              const isBenchmark = benchmarkId != null
                ? h.id === benchmarkId
                : h.id === history[0]?.id;
              const delta = benchmarkBu != null ? h.forecastBu - benchmarkBu : null;

              return (
                <tr
                  key={h.id}
                  className={cn(
                    "hover:bg-row-hover transition-colors",
                    isBenchmark && "bg-action/5 border-l-2 border-action"
                  )}
                >
                  <td className="px-3 py-1.5 text-muted whitespace-nowrap">{fmtDate(h.recordedAt)}</td>
                  <td className="px-3 py-1.5 text-faint">{h.recordedBy ?? "\u2014"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-secondary">{fmtVol(h.forecastBu)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {delta != null && delta !== 0 ? (
                      <span className={cn("font-medium", delta > 0 ? "text-profit" : "text-loss")}>
                        {delta > 0 ? "+" : ""}{fmtVol(delta)}
                      </span>
                    ) : delta === 0 ? (
                      <span className="text-faint">\u2014</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5 text-faint">{h.notes ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!showAll && history.length > 10 && (
        <button onClick={() => setShowAll(true)} className="text-xs text-action hover:text-action mt-1 transition-colors">
          Show all ({history.length})
        </button>
      )}
    </div>
  );
}
