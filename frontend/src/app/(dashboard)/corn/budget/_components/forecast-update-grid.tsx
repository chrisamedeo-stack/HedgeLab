"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { BUSHELS_PER_MT, monthLabel } from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { fmtVol } from "./shared";

export function ForecastUpdateGrid({ lines, onSaved, onCancel }: {
  lines: CornBudgetLineResponse[]; onSaved: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [forecasts, setForecasts] = useState<Record<number, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.forecastVolumeMt != null ? String(l.forecastVolumeMt) : String(l.budgetVolumeMt ?? "")]))
  );

  function updateForecast(id: number, v: string) {
    setForecasts((f) => ({ ...f, [id]: v }));
  }

  const changedLines = lines.filter((l) => {
    const newVal = parseFloat(forecasts[l.id]) || 0;
    const oldVal = l.forecastVolumeMt ?? l.budgetVolumeMt ?? 0;
    return Math.abs(newVal - oldVal) > 0.001;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (changedLines.length === 0) { toast("No changes to save", "error"); return; }
    setSubmitting(true);
    try {
      await api.post("/api/v1/corn/budget/forecast-batch", {
        note: note || null,
        updates: changedLines.map((l) => ({
          budgetLineId: l.id,
          forecastVolumeMt: parseFloat(forecasts[l.id]) || 0,
        })),
      });
      toast(`${changedLines.length} forecast${changedLines.length !== 1 ? "s" : ""} updated`, "success");
      onSaved();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Forecast update failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Update Forecasts</h2>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Update Note</label>
        <input type="text" placeholder="e.g. March review" value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
      </div>
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700">
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Month</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium">Budget MT</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium">Current Fcst MT</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium">New Forecast MT</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-28">BU equiv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {lines.map((l) => {
              const newVal = parseFloat(forecasts[l.id]) || 0;
              const oldVal = l.forecastVolumeMt ?? l.budgetVolumeMt ?? 0;
              const changed = Math.abs(newVal - oldVal) > 0.001;
              return (
                <tr key={l.id} className={changed ? "bg-blue-500/5" : ""}>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{monthLabel(l.budgetMonth)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtVol(l.budgetVolumeMt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{l.forecastVolumeMt != null ? fmtVol(l.forecastVolumeMt) : "\u2014"}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="any" min="0" value={forecasts[l.id]}
                      onChange={(e) => updateForecast(l.id, e.target.value)}
                      className="w-full bg-transparent text-slate-200 text-right tabular-nums focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500 text-xs">
                    {newVal > 0 ? fmtVol(Math.round(newVal * BUSHELS_PER_MT)) : "\u2014"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{changedLines.length} month{changedLines.length !== 1 ? "s" : ""} changed</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
          <button type="submit" disabled={submitting || changedLines.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {submitting ? "Saving\u2026" : `Update ${changedLines.length} forecast${changedLines.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </form>
  );
}
