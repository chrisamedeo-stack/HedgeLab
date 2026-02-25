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
    Object.fromEntries(lines.map((l) => [l.id, String(Math.round((l.forecastVolumeMt ?? l.budgetVolumeMt ?? 0) * BUSHELS_PER_MT))]))
  );

  function updateForecast(id: number, v: string) {
    setForecasts((f) => ({ ...f, [id]: v }));
  }

  const changedLines = lines.filter((l) => {
    const newBu = parseFloat(forecasts[l.id]) || 0;
    const oldBu = Math.round((l.forecastVolumeMt ?? l.budgetVolumeMt ?? 0) * BUSHELS_PER_MT);
    return Math.abs(newBu - oldBu) > 0.5;
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
          forecastVolumeMt: (parseFloat(forecasts[l.id]) || 0) / BUSHELS_PER_MT,
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
    <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary">Update Forecasts</h2>
        <button type="button" onClick={onCancel} className="text-faint hover:text-secondary transition-colors"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted">Update Note</label>
        <input type="text" placeholder="e.g. March review" value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph" />
      </div>
      <div className="rounded-lg border border-b-input overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-input-bg/60 border-b border-b-input">
              <th className="px-3 py-2 text-left text-xs text-muted font-medium">Month</th>
              <th className="px-3 py-2 text-right text-xs text-muted font-medium">Budget Bu</th>
              <th className="px-3 py-2 text-right text-xs text-muted font-medium">Current Fcst Bu</th>
              <th className="px-3 py-2 text-right text-xs text-muted font-medium">New Forecast Bu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default">
            {lines.map((l) => {
              const newBu = parseFloat(forecasts[l.id]) || 0;
              const oldBu = Math.round((l.forecastVolumeMt ?? l.budgetVolumeMt ?? 0) * BUSHELS_PER_MT);
              const changed = Math.abs(newBu - oldBu) > 0.5;
              return (
                <tr key={l.id} className={changed ? "bg-action-5" : ""}>
                  <td className="px-3 py-2 text-secondary whitespace-nowrap">{monthLabel(l.budgetMonth)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-faint">{fmtVol(Math.round(l.budgetVolumeMt * BUSHELS_PER_MT))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{l.forecastVolumeMt != null ? fmtVol(Math.round(l.forecastVolumeMt * BUSHELS_PER_MT)) : "\u2014"}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="1" min="0" value={forecasts[l.id]}
                      onChange={(e) => updateForecast(l.id, e.target.value)}
                      className="w-full bg-transparent text-secondary text-right tabular-nums focus:outline-none" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-faint">{changedLines.length} month{changedLines.length !== 1 ? "s" : ""} changed</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-muted hover:text-secondary text-sm transition-colors">Cancel</button>
          <button type="submit" disabled={submitting || changedLines.length === 0}
            className="px-5 py-2 bg-action hover:bg-action-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {submitting ? "Saving\u2026" : `Update ${changedLines.length} forecast${changedLines.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </form>
  );
}
