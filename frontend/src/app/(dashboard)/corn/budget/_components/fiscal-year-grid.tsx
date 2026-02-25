"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useSites } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import {
  BUSHELS_PER_MT,
  suggestFuturesMonth,
  fiscalYearMonths,
  availableFiscalYears,
  monthLabel,
} from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { COMMODITY_OPTIONS, ComponentRow, fmtPrice } from "./shared";
import { ComponentEditor, ComponentTokenBar } from "./component-editor";

export function FiscalYearGrid({ onSaved, onCancel, fyStartMonth = 7 }: { onSaved: () => void; onCancel: () => void; fyStartMonth?: number }) {
  const { sites } = useSites();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState({ siteCode: "", commodityCode: "CORN-ZC", fiscalYear: availableFiscalYears(fyStartMonth)[2] });
  const [components, setComponents] = useState<ComponentRow[]>([]);
  type MRow = { volume: string; futuresMonth: string; notes: string };
  const mkRows = (fy: string) =>
    Object.fromEntries(fiscalYearMonths(fy, fyStartMonth).map((m) => [m, { volume: "", futuresMonth: suggestFuturesMonth(m), notes: "" }]));
  const [rows, setRows] = useState<Record<string, MRow>>(() => mkRows(config.fiscalYear));

  const sharedTotalPerBu = components.reduce((sum, r) => {
    const val = parseFloat(r.targetValue);
    if (isNaN(val)) return sum;
    return sum + (r.unit === "$/bu" ? val : val / BUSHELS_PER_MT);
  }, 0);

  function handleFYChange(fy: string) {
    setConfig((c) => ({ ...c, fiscalYear: fy }));
    setRows(mkRows(fy));
  }
  function updateRow(m: string, f: keyof MRow, v: string) { setRows((r) => ({ ...r, [m]: { ...r[m], [f]: v } })); }
  function applyAll(v: string) { setRows((r) => Object.fromEntries(Object.entries(r).map(([m, row]) => [m, { ...row, volume: v }]))); }

  const months = fiscalYearMonths(config.fiscalYear, fyStartMonth);

  const totalBu = useMemo(() => {
    let total = 0;
    for (const m of months) {
      total += parseFloat(rows[m]?.volume) || 0;
    }
    return total;
  }, [months, rows]);

  const filledCount = months.filter((m) => parseFloat(rows[m]?.volume) > 0).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config.siteCode) { toast("Select a site", "error"); return; }
    const sharedComponentPayload = components
      .map((r, i) => ({ componentName: r.componentName, unit: r.unit, targetValue: parseFloat(r.targetValue), displayOrder: i + 1 }))
      .filter((c) => c.componentName && !isNaN(c.targetValue));
    const lines = months.filter((m) => parseFloat(rows[m]?.volume) > 0).map((m) => {
      const bu = parseFloat(rows[m].volume);
      const mt = bu / BUSHELS_PER_MT;
      return { siteCode: config.siteCode, commodityCode: config.commodityCode, budgetMonth: m,
        futuresMonth: rows[m].futuresMonth || null, budgetVolumeBu: bu, budgetVolumeMt: mt,
        fiscalYear: config.fiscalYear, notes: rows[m].notes || null,
        components: sharedComponentPayload };
    });
    if (lines.length === 0) { toast("Enter volume for at least one month", "error"); return; }
    setSubmitting(true);
    try {
      await api.post("/api/v1/corn/budget/bulk", lines);
      toast(`${lines.length} budget lines created`, "success");
      onSaved();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Bulk save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary">New Fiscal Year Budget</h2>
        <button type="button" onClick={onCancel} className="text-faint hover:text-secondary transition-colors"><X className="h-4 w-4" /></button>
      </div>
      {/* Config Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">Site</label>
          <select value={config.siteCode} onChange={(e) => setConfig((c) => ({ ...c, siteCode: e.target.value }))} required
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action">
            <option value="">&mdash; Select &mdash;</option>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Commodity</label>
          <select value={config.commodityCode} onChange={(e) => setConfig((c) => ({ ...c, commodityCode: e.target.value }))}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action">
            {COMMODITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Fiscal Year</label>
          <select value={config.fiscalYear} onChange={(e) => handleFYChange(e.target.value)}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action">
            {availableFiscalYears(fyStartMonth).map((fy) => <option key={fy}>{fy}</option>)}
          </select>
        </div>
      </div>
      {/* Cost Components (shared across all months) */}
      <div className="space-y-2">
        <label className="text-xs text-muted block">Cost Components (shared across all months)</label>
        <ComponentEditor rows={components} onChange={setComponents} />
        <ComponentTokenBar rows={components} />
      </div>
      {/* Default Volume */}
      <div className="rounded-lg bg-input-bg/40 border border-b-input/50 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted whitespace-nowrap">Default volume:</label>
          <input type="number" placeholder="bushels" step="1" min="0"
            className="w-32 bg-input-bg border border-b-input text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action placeholder:text-ph"
            onChange={(e) => applyAll(e.target.value)} />
          <span className="text-xs text-ph">bu/month</span>
        </div>
        <p className="text-xs text-ph">Sets all months &mdash; override individually below</p>
      </div>
      {/* Monthly Grid */}
      <div className="rounded-lg border border-b-input overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-input-bg/60 border-b border-b-input">
              <th className="px-3 py-2 text-left text-xs text-muted font-medium w-20">Month</th>
              <th className="px-3 py-2 text-right text-xs text-muted font-medium">Bushels</th>
              <th className="px-3 py-2 text-right text-xs text-muted font-medium w-36">All-in $/bu</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium w-28">Futures Ref</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default">
            {months.map((m) => {
              const row = rows[m] ?? { volume: "", futuresMonth: "", notes: "" };
              return (
                <tr key={m} className={m.endsWith("-07") ? "border-t-2 border-action-30" : ""}>
                  <td className="px-3 py-2 font-medium text-secondary whitespace-nowrap">{monthLabel(m)}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="1" min="0" placeholder="0" value={row.volume}
                      onChange={(e) => updateRow(m, "volume", e.target.value)}
                      className="w-full bg-transparent text-secondary text-right tabular-nums placeholder:text-ph focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {sharedTotalPerBu > 0 ? (
                      <span className="text-action">${sharedTotalPerBu.toFixed(4)}/bu</span>
                    ) : <span className="text-ph">&mdash;</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" placeholder="e.g. ZCN26" value={row.futuresMonth}
                      onChange={(e) => updateRow(m, "futuresMonth", e.target.value)}
                      className="w-full bg-transparent text-muted placeholder:text-ph focus:outline-none text-xs" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" placeholder="Optional" value={row.notes}
                      onChange={(e) => updateRow(m, "notes", e.target.value)}
                      className="w-full bg-transparent text-faint placeholder:text-ph focus:outline-none text-xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-input-bg/50 border-t border-b-input">
              <td className="px-3 py-2 text-xs text-faint font-medium">Total</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-secondary text-sm">
                {totalBu > 0
                  ? totalBu.toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : "\u2014"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs">
                {sharedTotalPerBu > 0 ? <span className="text-action font-medium">${sharedTotalPerBu.toFixed(4)}/bu</span> : ""}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-muted hover:text-secondary text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-action hover:bg-action-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? "Saving\u2026" : `Save ${filledCount} month${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}
