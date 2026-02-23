"use client";

import { useState } from "react";
import { useForecastHistory } from "@/hooks/useCorn";
import { fmtVol, fmtDate } from "./shared";

export function ForecastHistoryTimeline({ budgetLineId }: { budgetLineId: number }) {
  const { history, isLoading } = useForecastHistory(budgetLineId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <p className="text-xs text-slate-600 py-2">Loading history...</p>;
  if (history.length === 0) return null;

  const visible = showAll ? history : history.slice(0, 10);

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/50">
      <p className="text-xs text-slate-500 font-medium mb-2">Forecast History</p>
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/40">
              <th className="px-3 py-1.5 text-left text-slate-500 font-medium">Date</th>
              <th className="px-3 py-1.5 text-left text-slate-500 font-medium">By</th>
              <th className="px-3 py-1.5 text-right text-slate-500 font-medium">Forecast MT</th>
              <th className="px-3 py-1.5 text-right text-slate-500 font-medium">BU equiv</th>
              <th className="px-3 py-1.5 text-left text-slate-500 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {visible.map((h) => (
              <tr key={h.id}>
                <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmtDate(h.recordedAt)}</td>
                <td className="px-3 py-1.5 text-slate-500">{h.recordedBy ?? "\u2014"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{fmtVol(h.forecastMt)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{fmtVol(h.forecastBu)}</td>
                <td className="px-3 py-1.5 text-slate-500">{h.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAll && history.length > 10 && (
        <button onClick={() => setShowAll(true)} className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors">
          Show all ({history.length})
        </button>
      )}
    </div>
  );
}
