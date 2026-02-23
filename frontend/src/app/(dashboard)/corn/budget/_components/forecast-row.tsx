"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { BUSHELS_PER_MT, monthLabel } from "@/lib/corn-utils";
import { cn } from "@/lib/utils";
import { fmtVol } from "./shared";
import { InlineForecastEdit } from "./inline-forecast-edit";
import { ForecastHistoryTimeline } from "./forecast-history";

export function ForecastRow({ line, onUpdated }: {
  line: CornBudgetLineResponse; onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingForecast, setEditingForecast] = useState(false);

  const forecastMt = line.forecastVolumeMt ?? line.budgetVolumeMt;
  const coveragePct = forecastMt > 0 && line.hedgedVolumeMt != null
    ? (line.hedgedVolumeMt / forecastMt) * 100
    : null;

  return (
    <>
      <tr className="hover:bg-slate-800/40 transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded((v) => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3 text-slate-300">{monthLabel(line.budgetMonth)}</td>
        <td className="px-4 py-3 tabular-nums text-slate-500 text-right text-xs">{fmtVol(Math.round(line.budgetVolumeMt * BUSHELS_PER_MT))}</td>
        <td className="px-4 py-3 text-right">
          {editingForecast ? (
            <InlineForecastEdit line={line} onSaved={() => { setEditingForecast(false); onUpdated(); }} onCancel={() => setEditingForecast(false)} />
          ) : (
            <button onClick={() => setEditingForecast(true)} className="tabular-nums text-xs text-slate-300 hover:text-blue-400 transition-colors cursor-pointer">
              {line.forecastVolumeMt != null ? fmtVol(Math.round(line.forecastVolumeMt * BUSHELS_PER_MT)) : "\u2014"}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {line.forecastVarianceMt != null ? (
            <span className={cn("tabular-nums text-xs font-medium",
              line.forecastVarianceMt < 0 ? "text-red-400" : line.forecastVarianceMt > 0 ? "text-green-400" : "text-slate-500")}>
              {line.forecastVarianceMt > 0 ? "+" : ""}{fmtVol(Math.round(line.forecastVarianceMt * BUSHELS_PER_MT))}
            </span>
          ) : <span className="text-slate-600 text-xs">&mdash;</span>}
        </td>
        <td className="px-4 py-3 tabular-nums text-slate-400 text-right text-xs">
          {line.hedgedVolumeMt != null ? fmtVol(Math.round(line.hedgedVolumeMt * BUSHELS_PER_MT)) : "\u2014"}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-xs">
          {coveragePct != null ? (
            <span className={cn("font-medium",
              coveragePct >= 100 ? "text-emerald-400" : coveragePct >= 50 ? "text-blue-400" : "text-slate-400")}>
              {coveragePct.toFixed(0)}%
            </span>
          ) : <span className="text-slate-600">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-center">
          {line.overHedged && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/10 ring-1 ring-orange-500/30 text-orange-400 text-xs font-medium">
              Over
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-slate-500 text-xs">{line.notes ?? ""}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="px-8 py-3 bg-slate-950/40 border-t border-slate-800/50">
            <ForecastHistoryTimeline budgetLineId={line.id} />
          </td>
        </tr>
      )}
    </>
  );
}
