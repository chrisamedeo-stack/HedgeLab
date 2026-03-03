"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { CornBudgetLineResponse, useForecastHistory } from "@/hooks/useCorn";
import { useCommodity } from "@/contexts/CommodityContext";
import { monthLabel } from "@/lib/corn-utils";
import { chartTheme } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";
import { fmtVol } from "./shared";
import { InlineForecastEdit } from "./inline-forecast-edit";
import { ForecastHistoryTimeline } from "./forecast-history";

export function ForecastRow({ line, onUpdated }: {
  line: CornBudgetLineResponse; onUpdated: () => void;
}) {
  const { slug, config } = useCommodity();
  const BUSHELS_PER_MT = config.bushelsPerMt;
  const [expanded, setExpanded] = useState(false);
  const [editingForecast, setEditingForecast] = useState(false);
  const [benchmarkId, setBenchmarkId] = useState<number | null>(null);

  const { history } = useForecastHistory(slug, line.id);

  // Sparkline data: reverse so oldest is leftmost
  const sparkData = history.length >= 2
    ? [...history].reverse().map((h) => ({ v: h.forecastBu }))
    : null;

  // Resolve benchmark for variance override
  const benchmarkEntry = benchmarkId != null
    ? history.find((h) => h.id === benchmarkId)
    : null;

  const forecastMt = line.forecastVolumeMt ?? line.budgetVolumeMt;
  const forecastBu = line.forecastVolumeBu ?? (line.forecastVolumeMt != null
    ? line.forecastVolumeMt * BUSHELS_PER_MT
    : line.budgetVolumeMt * BUSHELS_PER_MT);

  // If a benchmark is selected, override the variance display
  const varianceBu = benchmarkEntry
    ? forecastBu - benchmarkEntry.forecastBu
    : line.forecastVarianceMt != null
      ? line.forecastVarianceMt * BUSHELS_PER_MT
      : null;

  const coveragePct = forecastMt > 0 && line.hedgedVolumeMt != null
    ? (line.hedgedVolumeMt / forecastMt) * 100
    : null;

  return (
    <>
      <tr className="hover:bg-row-hover transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded((v) => !v)} className="text-faint hover:text-secondary transition-colors">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3 text-secondary">{monthLabel(line.budgetMonth)}</td>
        <td className="px-4 py-3 tabular-nums text-faint text-right text-xs">{fmtVol(Math.round(line.budgetVolumeMt * BUSHELS_PER_MT))}</td>
        <td className="px-4 py-3 text-right">
          {editingForecast ? (
            <InlineForecastEdit line={line} onSaved={() => { setEditingForecast(false); onUpdated(); }} onCancel={() => setEditingForecast(false)} />
          ) : (
            <button onClick={() => setEditingForecast(true)} className="tabular-nums text-xs text-secondary hover:text-action transition-colors cursor-pointer">
              {line.forecastVolumeMt != null ? fmtVol(Math.round(line.forecastVolumeMt * BUSHELS_PER_MT)) : "\u2014"}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {varianceBu != null ? (
            <span className={cn("tabular-nums text-xs font-medium",
              varianceBu < 0 ? "text-loss" : varianceBu > 0 ? "text-profit" : "text-faint")}>
              {varianceBu > 0 ? "+" : ""}{fmtVol(Math.round(varianceBu))}
            </span>
          ) : <span className="text-ph text-xs">&mdash;</span>}
        </td>
        <td className="px-4 py-3 w-[96px]">
          {sparkData ? (
            <div className="w-20 h-6 mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={chartTheme.accent}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <span className="text-ph text-xs block text-center">&mdash;</span>
          )}
        </td>
        <td className="px-4 py-3 tabular-nums text-muted text-right text-xs">
          {line.hedgedVolumeMt != null ? fmtVol(Math.round(line.hedgedVolumeMt * BUSHELS_PER_MT)) : "\u2014"}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-xs">
          {coveragePct != null ? (
            <span className={cn("font-medium",
              coveragePct >= 100 ? "text-profit" : coveragePct >= 50 ? "text-action" : "text-muted")}>
              {coveragePct.toFixed(0)}%
            </span>
          ) : <span className="text-ph">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-center">
          {line.overHedged && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-warning-10 ring-1 ring-warning-30 text-warning text-xs font-medium">
              Over
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-faint text-xs">{line.notes ?? ""}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="px-8 py-3 bg-main/40 border-t border-b-default/50">
            <ForecastHistoryTimeline
              budgetLineId={line.id}
              history={history}
              benchmarkId={benchmarkId}
              onBenchmarkChange={setBenchmarkId}
            />
          </td>
        </tr>
      )}
    </>
  );
}
