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
  const [volumeUnit, setVolumeUnit] = useState<"BU" | "MT">("BU");
  const [config, setConfig] = useState({ siteCode: "", commodityCode: "CORN-ZC", fiscalYear: availableFiscalYears(fyStartMonth)[2] });
  const [components, setComponents] = useState<ComponentRow[]>([]);
  type MRow = { volume: string; futuresMonth: string; notes: string };
  const mkRows = (fy: string) =>
    Object.fromEntries(fiscalYearMonths(fy, fyStartMonth).map((m) => [m, { volume: "", futuresMonth: suggestFuturesMonth(m), notes: "" }]));
  const [rows, setRows] = useState<Record<string, MRow>>(() => mkRows(config.fiscalYear));

  const sharedTotalPerMt = components.reduce((sum, r) => {
    const val = parseFloat(r.targetValue);
    if (isNaN(val)) return sum;
    return sum + (r.unit === "¢/bu" ? (val / 100) * BUSHELS_PER_MT : r.unit === "$/bu" ? val * BUSHELS_PER_MT : val);
  }, 0);
  const sharedTotalDollarsBu = sharedTotalPerMt > 0 ? sharedTotalPerMt / BUSHELS_PER_MT : 0;

  function handleFYChange(fy: string) {
    setConfig((c) => ({ ...c, fiscalYear: fy }));
    setRows(mkRows(fy));
  }
  function updateRow(m: string, f: keyof MRow, v: string) { setRows((r) => ({ ...r, [m]: { ...r[m], [f]: v } })); }
  function applyAll(v: string) { setRows((r) => Object.fromEntries(Object.entries(r).map(([m, row]) => [m, { ...row, volume: v }]))); }

  const months = fiscalYearMonths(config.fiscalYear, fyStartMonth);

  const totals = useMemo(() => {
    let totalBu = 0, totalMt = 0;
    for (const m of months) {
      const raw = parseFloat(rows[m]?.volume) || 0;
      if (volumeUnit === "BU") { totalBu += raw; totalMt += raw / BUSHELS_PER_MT; }
      else { totalMt += raw; totalBu += raw * BUSHELS_PER_MT; }
    }
    return { totalBu, totalMt };
  }, [months, rows, volumeUnit]);

  const filledCount = months.filter((m) => parseFloat(rows[m]?.volume) > 0).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config.siteCode) { toast("Select a site", "error"); return; }
    const sharedComponentPayload = components
      .map((r, i) => ({ componentName: r.componentName, unit: r.unit, targetValue: parseFloat(r.targetValue), displayOrder: i + 1 }))
      .filter((c) => c.componentName && !isNaN(c.targetValue));
    const lines = months.filter((m) => parseFloat(rows[m]?.volume) > 0).map((m) => {
      const raw = parseFloat(rows[m].volume);
      const bu = volumeUnit === "BU" ? raw : raw * BUSHELS_PER_MT;
      const mt = volumeUnit === "MT" ? raw : raw / BUSHELS_PER_MT;
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
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">New Fiscal Year Budget</h2>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors"><X className="h-4 w-4" /></button>
      </div>
      {/* Config Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Site</label>
          <select value={config.siteCode} onChange={(e) => setConfig((c) => ({ ...c, siteCode: e.target.value }))} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">&mdash; Select &mdash;</option>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Commodity</label>
          <select value={config.commodityCode} onChange={(e) => setConfig((c) => ({ ...c, commodityCode: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            {COMMODITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Fiscal Year</label>
          <select value={config.fiscalYear} onChange={(e) => handleFYChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            {availableFiscalYears(fyStartMonth).map((fy) => <option key={fy}>{fy}</option>)}
          </select>
        </div>
      </div>
      {/* Cost Components (shared across all months) */}
      <div className="space-y-2">
        <label className="text-xs text-slate-400 block">Cost Components (shared across all months)</label>
        <ComponentEditor rows={components} onChange={setComponents} />
        <ComponentTokenBar rows={components} />
      </div>
      {/* Default Volume */}
      <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">Default volume:</label>
          <input type="number" placeholder={volumeUnit === "BU" ? "bushels" : "MT"} step={volumeUnit === "BU" ? "1" : "any"} min="0"
            className="w-32 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
            onChange={(e) => applyAll(e.target.value)} />
          <span className="text-xs text-slate-600">{volumeUnit === "BU" ? "bu" : "MT"}/month</span>
          <button type="button" onClick={() => setVolumeUnit(volumeUnit === "BU" ? "MT" : "BU")}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors ml-2">
            Switch to {volumeUnit === "BU" ? "MT" : "BU"}
          </button>
        </div>
        <p className="text-xs text-slate-600">Sets all months &mdash; override individually below</p>
      </div>
      {/* Monthly Grid */}
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700">
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium w-20">Month</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium">{volumeUnit === "BU" ? "Bushels" : "MT"}</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-28">{volumeUnit === "BU" ? "MT (auto)" : "BU (auto)"}</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-36">All-in</th>
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium w-28">Futures Ref</th>
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {months.map((m) => {
              const row = rows[m] ?? { volume: "", futuresMonth: "", notes: "" };
              const raw  = parseFloat(row.volume) || 0;
              const bu = volumeUnit === "BU" ? raw : raw * BUSHELS_PER_MT;
              const mt = volumeUnit === "MT" ? raw : raw / BUSHELS_PER_MT;
              const autoVal = volumeUnit === "BU" ? mt : bu;
              return (
                <tr key={m} className={m.endsWith("-07") ? "border-t-2 border-blue-500/30" : ""}>
                  <td className="px-3 py-2 font-medium text-slate-300 whitespace-nowrap">{monthLabel(m)}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" step={volumeUnit === "BU" ? "1" : "any"} min="0" placeholder="0" value={row.volume}
                      onChange={(e) => updateRow(m, "volume", e.target.value)}
                      className="w-full bg-transparent text-slate-200 text-right tabular-nums placeholder:text-slate-700 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500 text-xs">
                    {autoVal > 0
                      ? (volumeUnit === "BU"
                          ? autoVal.toLocaleString("en-US", { maximumFractionDigits: 1 })
                          : autoVal.toLocaleString("en-US", { maximumFractionDigits: 0 }))
                      : "\u2014"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {sharedTotalPerMt > 0 ? (
                      <div>
                        <span className="text-blue-400">${sharedTotalDollarsBu.toFixed(2)}/bu</span>
                        <br />
                        <span className="text-slate-500">${fmtPrice(sharedTotalPerMt)}/MT</span>
                      </div>
                    ) : <span className="text-slate-700">&mdash;</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" placeholder="e.g. ZCN26" value={row.futuresMonth}
                      onChange={(e) => updateRow(m, "futuresMonth", e.target.value)}
                      className="w-full bg-transparent text-slate-400 placeholder:text-slate-700 focus:outline-none text-xs" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" placeholder="Optional" value={row.notes}
                      onChange={(e) => updateRow(m, "notes", e.target.value)}
                      className="w-full bg-transparent text-slate-500 placeholder:text-slate-700 focus:outline-none text-xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800/50 border-t border-slate-700">
              <td className="px-3 py-2 text-xs text-slate-500 font-medium">Total</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-200 text-sm">
                {(volumeUnit === "BU" ? totals.totalBu : totals.totalMt) > 0
                  ? (volumeUnit === "BU" ? totals.totalBu : totals.totalMt).toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : "\u2014"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-400 text-xs">
                {(volumeUnit === "BU" ? totals.totalMt : totals.totalBu) > 0
                  ? (volumeUnit === "BU" ? totals.totalMt : totals.totalBu).toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : "\u2014"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs">
                {sharedTotalPerMt > 0 ? <span className="text-blue-400 font-medium">${fmtPrice(sharedTotalPerMt)}/MT</span> : ""}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? "Saving\u2026" : `Save ${filledCount} month${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}
