"use client";

import { useState } from "react";
import { useForecastHistory } from "@/hooks/useCorn";
import { fmtVol, fmtDate } from "./shared";

export function ForecastHistoryTimeline({ budgetLineId }: { budgetLineId: number }) {
  const { history, isLoading } = useForecastHistory(budgetLineId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <p className="text-xs text-ph py-2">Loading history...</p>;
  if (history.length === 0) return null;

  const visible = showAll ? history : history.slice(0, 10);

  return (
    <div className="mt-3 pt-3 border-t border-b-default/50">
      <p className="text-xs text-faint font-medium mb-2">Forecast History</p>
      <div className="rounded-lg border border-b-default overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-tbl-header">
              <th className="px-3 py-1.5 text-left text-faint font-medium">Date</th>
              <th className="px-3 py-1.5 text-left text-faint font-medium">By</th>
              <th className="px-3 py-1.5 text-right text-faint font-medium">Forecast Bu</th>
              <th className="px-3 py-1.5 text-left text-faint font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default/50">
            {visible.map((h) => (
              <tr key={h.id} className="hover:bg-row-hover transition-colors">
                <td className="px-3 py-1.5 text-muted whitespace-nowrap">{fmtDate(h.recordedAt)}</td>
                <td className="px-3 py-1.5 text-faint">{h.recordedBy ?? "\u2014"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-secondary">{fmtVol(h.forecastBu)}</td>
                <td className="px-3 py-1.5 text-faint">{h.notes ?? ""}</td>
              </tr>
            ))}
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
