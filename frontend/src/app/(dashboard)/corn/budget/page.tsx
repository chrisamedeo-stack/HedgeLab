"use client";

import { Fragment, useState, useMemo } from "react";
import {
  BookOpen, Plus, Edit2, Trash2, X,
  ChevronDown, ChevronRight, CalendarDays, RefreshCw, Check,
} from "lucide-react";
import {
  useBudget, useSites, useForecastHistory,
  CornBudgetLineResponse, ForecastHistoryDto,
} from "@/hooks/useCorn";
import { useAdminSites, useAppSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import {
  BUSHELS_PER_MT,
  suggestFuturesMonth,
  deriveFiscalYear,
  fiscalYearMonths,
  availableFiscalYears,
  currentFiscalYear,
  monthLabel,
} from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMODITY_OPTIONS = [
  { value: "CORN-ZC", label: "Corn (CBOT ZC)" },
  { value: "CORN",    label: "Corn (Generic)" },
];
const UNIT_OPTIONS = ["$/bu", "$/MT", "¢/bu", "CAD/MT", "%"];
const PRESET_COMPONENTS = [
  { name: "Board Price",     unit: "$/bu" },
  { name: "Basis",           unit: "$/bu" },
  { name: "Freight",         unit: "$/MT" },
  { name: "Elevation",       unit: "$/MT" },
  { name: "Insurance",       unit: "$/MT" },
  { name: "FX Premium",      unit: "$/MT" },
  { name: "Quality Premium", unit: "$/MT" },
];

/** Compute notional spend with client-side fallback */
function lineNotional(l: CornBudgetLineResponse): number | null {
  return l.totalNotionalSpend
    ?? (l.targetAllInPerMt != null && l.budgetVolumeMt != null ? l.targetAllInPerMt * l.budgetVolumeMt : null);
}

function fmtVol(n: number | null | undefined): string {
  if (n == null || n === 0) return "\u2014";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDollars(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

// ─── Component Editor ─────────────────────────────────────────────────────────

interface ComponentRow { key: number; componentName: string; unit: string; targetValue: string; displayOrder: number; }

function ComponentEditor({ rows, onChange }: { rows: ComponentRow[]; onChange: (r: ComponentRow[]) => void }) {
  function updateRow(key: number, field: keyof ComponentRow, value: string) {
    onChange(rows.map((r) => r.key === key ? { ...r, [field]: value } : r));
  }
  function removeRow(key: number) { onChange(rows.filter((r) => r.key !== key)); }
  function addPreset(p: { name: string; unit: string }) {
    onChange([...rows, { key: Date.now(), componentName: p.name, unit: p.unit, targetValue: "", displayOrder: rows.length + 1 }]);
  }

  const totalPerMt = rows.reduce((sum, r) => {
    const val = parseFloat(r.targetValue);
    if (isNaN(val)) return sum;
    return sum + (r.unit === "¢/bu" ? (val / 100) * BUSHELS_PER_MT : r.unit === "$/bu" ? val * BUSHELS_PER_MT : val);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-slate-500 self-center">Quick add:</span>
        {PRESET_COMPONENTS.map((p) => (
          <button key={p.name} type="button" onClick={() => addPreset(p)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors">
            {p.name}
          </button>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/60">
                <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium">Component</th>
                <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium w-28">Unit</th>
                <th className="px-3 py-2 text-right text-xs text-slate-500 font-medium w-32">Target Value</th>
                <th className="px-3 py-2 text-right text-xs text-slate-500 font-medium w-28">&asymp; $/MT</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => {
                const val = parseFloat(r.targetValue);
                const perMt = isNaN(val) ? null : r.unit === "¢/bu" ? (val / 100) * BUSHELS_PER_MT : r.unit === "$/bu" ? val * BUSHELS_PER_MT : val;
                return (
                  <tr key={r.key} className="hover:bg-slate-800/30">
                    <td className="px-3 py-1.5">
                      <input type="text" value={r.componentName} onChange={(e) => updateRow(r.key, "componentName", e.target.value)}
                        placeholder="e.g. Basis" className="w-full bg-transparent text-slate-200 placeholder:text-slate-600 focus:outline-none" />
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={r.unit} onChange={(e) => updateRow(r.key, "unit", e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full">
                        {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                        {!UNIT_OPTIONS.includes(r.unit) && <option value={r.unit}>{r.unit}</option>}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input type="number" step="any" value={r.targetValue} onChange={(e) => updateRow(r.key, "targetValue", e.target.value)}
                        className="w-full bg-transparent text-slate-200 text-right placeholder:text-slate-600 focus:outline-none tabular-nums" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-400 tabular-nums text-xs">
                      {perMt != null ? fmtPrice(perMt) : "\u2014"}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <button type="button" onClick={() => removeRow(r.key)} className="text-slate-600 hover:text-red-400 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800/40 border-t border-slate-700">
                <td colSpan={3} className="px-3 py-2 text-xs text-slate-500 text-right font-medium">All-in target</td>
                <td className="px-3 py-2 text-right font-bold text-blue-400 tabular-nums text-sm">
                  {totalPerMt > 0 ? `$${fmtPrice(totalPerMt)}` : "\u2014"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <button type="button" onClick={() => onChange([...rows, { key: Date.now(), componentName: "", unit: "$/MT", targetValue: "", displayOrder: rows.length + 1 }])}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1">
        <Plus className="h-3.5 w-3.5" /> Add custom component
      </button>
    </div>
  );
}

// ─── Component Token Bar ──────────────────────────────────────────────────────

function ComponentTokenBar({ rows }: { rows: ComponentRow[] }) {
  const filled = rows.filter((r) => r.componentName && r.targetValue && !isNaN(parseFloat(r.targetValue)));
  if (filled.length === 0) return null;
  const totalPerMt = filled.reduce((sum, r) => {
    const val = parseFloat(r.targetValue);
    return sum + (r.unit === "¢/bu" ? (val / 100) * BUSHELS_PER_MT : r.unit === "$/bu" ? val * BUSHELS_PER_MT : val);
  }, 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {filled.map((r, i) => (
        <Fragment key={r.key}>
          {i > 0 && <span className="text-slate-600 text-xs">+</span>}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 ring-1 ring-blue-500/20 text-blue-300 text-xs tabular-nums">
            {r.componentName}: {r.unit === "$/bu" || r.unit === "¢/bu" ? parseFloat(r.targetValue).toFixed(2) : parseFloat(r.targetValue).toLocaleString("en-US", { maximumFractionDigits: 2 })} {r.unit}
          </span>
        </Fragment>
      ))}
      <span className="text-slate-600 text-xs">=</span>
      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400 text-xs font-medium tabular-nums">
        ${fmtPrice(totalPerMt)}/MT
      </span>
    </div>
  );
}

// ─── Single-month Budget Line Form ────────────────────────────────────────────

function BudgetLineForm({ siteCode: defaultSite, onSaved, onCancel, editing, fyStartMonth = 7 }: {
  siteCode?: string; onSaved: () => void; onCancel: () => void; editing?: CornBudgetLineResponse; fyStartMonth?: number;
}) {
  const { sites } = useSites();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [volumeUnit, setVolumeUnit] = useState<"BU" | "MT">("BU");
  const [form, setForm] = useState({
    siteCode:      editing?.siteCode ?? defaultSite ?? "",
    commodityCode: editing?.commodityCode ?? "CORN-ZC",
    budgetMonth:   editing?.budgetMonth ?? "",
    futuresMonth:  editing?.futuresMonth ?? "",
    budgetVolumeBu: editing?.budgetVolumeBu != null ? String(editing.budgetVolumeBu)
      : editing?.budgetVolumeMt != null ? String(Math.round(editing.budgetVolumeMt * BUSHELS_PER_MT)) : "",
    budgetVolumeMt: editing?.budgetVolumeMt != null ? String(editing.budgetVolumeMt) : "",
    forecastVolumeMt: editing?.forecastVolumeMt != null ? String(editing.forecastVolumeMt) : "",
    notes: editing?.notes ?? "",
  });
  const [components, setComponents] = useState<ComponentRow[]>(
    editing?.components.map((c, i) => ({ key: i, componentName: c.componentName, unit: c.unit, targetValue: String(c.targetValue), displayOrder: c.displayOrder ?? i + 1 })) ?? []
  );

  function field(k: keyof typeof form, v: string) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "budgetMonth" && v && !f.futuresMonth) next.futuresMonth = suggestFuturesMonth(v);
      return next;
    });
  }

  const buVal = volumeUnit === "BU"
    ? (parseFloat(form.budgetVolumeBu) || 0)
    : (parseFloat(form.budgetVolumeMt) || 0) * BUSHELS_PER_MT;
  const mtVal = volumeUnit === "MT"
    ? (parseFloat(form.budgetVolumeMt) || 0)
    : (parseFloat(form.budgetVolumeBu) || 0) / BUSHELS_PER_MT;
  const fiscalYear = deriveFiscalYear(form.budgetMonth, fyStartMonth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const forecastMt = parseFloat(form.forecastVolumeMt) || null;
      const payload = {
        siteCode: form.siteCode, commodityCode: form.commodityCode,
        budgetMonth: form.budgetMonth, futuresMonth: form.futuresMonth || null,
        budgetVolumeBu: buVal || null, budgetVolumeMt: mtVal || null,
        fiscalYear: fiscalYear || null, notes: form.notes || null,
        forecastVolumeMt: forecastMt,
        components: components.map((r, i) => ({ componentName: r.componentName, unit: r.unit, targetValue: parseFloat(r.targetValue), displayOrder: i + 1 }))
          .filter((c) => c.componentName && !isNaN(c.targetValue)),
      };
      if (editing) {
        await api.put(`/api/v1/corn/budget/${editing.id}`, payload);
        toast("Budget line updated", "success");
      } else {
        await api.post("/api/v1/corn/budget", payload);
        toast("Budget line created", "success");
      }
      onSaved();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
      <h2 className="text-sm font-semibold text-slate-200">{editing ? "Edit Budget Line" : "New Budget Line"}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Site</label>
          <select value={form.siteCode} onChange={(e) => field("siteCode", e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">&mdash; Select &mdash;</option>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Commodity</label>
          <select value={form.commodityCode} onChange={(e) => field("commodityCode", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            {COMMODITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Budget Month</label>
          <input type="month" value={form.budgetMonth} onChange={(e) => field("budgetMonth", e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Futures Month</label>
          <input type="text" placeholder="e.g. ZCN26" value={form.futuresMonth} onChange={(e) => field("futuresMonth", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">Volume ({volumeUnit === "BU" ? "bushels" : "MT"})</label>
            <button type="button" onClick={() => setVolumeUnit(volumeUnit === "BU" ? "MT" : "BU")}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Switch to {volumeUnit === "BU" ? "MT" : "BU"}
            </button>
          </div>
          {volumeUnit === "BU" ? (
            <input type="number" step="1" min="0" placeholder="e.g. 196,842"
              value={form.budgetVolumeBu} onChange={(e) => field("budgetVolumeBu", e.target.value)} required
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
          ) : (
            <input type="number" step="any" min="0" placeholder="e.g. 5,000"
              value={form.budgetVolumeMt} onChange={(e) => field("budgetVolumeMt", e.target.value)} required
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">{volumeUnit === "BU" ? "MT" : "BU"} equivalent (auto)</label>
          <div className="bg-slate-800/50 border border-slate-700/50 text-slate-400 rounded-lg px-3 py-2 text-sm tabular-nums">
            {volumeUnit === "BU"
              ? (mtVal > 0 ? `${mtVal.toLocaleString("en-US", { maximumFractionDigits: 1 })} MT` : "\u2014")
              : (buVal > 0 ? `${buVal.toLocaleString("en-US", { maximumFractionDigits: 0 })} bu` : "\u2014")}
          </div>
        </div>
      </div>
      {form.budgetMonth && (
        <p className="text-xs text-slate-500">
          Fiscal year: <span className="text-slate-300 font-medium">{fiscalYear}</span>
          {form.futuresMonth && <> &middot; Futures: <span className="text-blue-400 font-medium">{form.futuresMonth}</span></>}
        </p>
      )}
      <div className="space-y-2">
        <label className="text-xs text-slate-400 block">Cost Components (optional)</label>
        <ComponentEditor rows={components} onChange={setComponents} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Forecast Volume (MT, optional)</label>
          <input type="number" step="any" min="0" placeholder="e.g. 4,500"
            value={form.forecastVolumeMt} onChange={(e) => field("forecastVolumeMt", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Notes</label>
          <input type="text" placeholder="Optional" value={form.notes} onChange={(e) => field("notes", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? "Saving\u2026" : editing ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

// ─── Fiscal Year Grid ─────────────────────────────────────────────────────────

function FiscalYearGrid({ onSaved, onCancel, fyStartMonth = 7 }: { onSaved: () => void; onCancel: () => void; fyStartMonth?: number }) {
  const { sites } = useSites();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [volumeUnit, setVolumeUnit] = useState<"BU" | "MT">("BU");
  const [config, setConfig] = useState({ siteCode: "", commodityCode: "CORN-ZC", fiscalYear: availableFiscalYears(fyStartMonth)[2] });
  const [components, setComponents] = useState<ComponentRow[]>([]);
  type MRow = { volume: string; futuresMonth: string; notes: string; forecastMt: string };
  const mkRows = (fy: string) =>
    Object.fromEntries(fiscalYearMonths(fy, fyStartMonth).map((m) => [m, { volume: "", futuresMonth: suggestFuturesMonth(m), notes: "", forecastMt: "" }]));
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
      const forecastMt = parseFloat(rows[m].forecastMt) || null;
      return { siteCode: config.siteCode, commodityCode: config.commodityCode, budgetMonth: m,
        futuresMonth: rows[m].futuresMonth || null, budgetVolumeBu: bu, budgetVolumeMt: mt,
        fiscalYear: config.fiscalYear, notes: rows[m].notes || null,
        forecastVolumeMt: forecastMt,
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
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-28">Fcst MT</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-36">All-in</th>
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium w-28">Futures Ref</th>
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {months.map((m) => {
              const row = rows[m] ?? { volume: "", futuresMonth: "", notes: "", forecastMt: "" };
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
                  <td className="px-3 py-1.5">
                    <input type="number" step="any" min="0" placeholder="\u2014" value={row.forecastMt}
                      onChange={(e) => updateRow(m, "forecastMt", e.target.value)}
                      className="w-full bg-transparent text-slate-300 text-right tabular-nums placeholder:text-slate-700 focus:outline-none text-xs" />
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
              <td />
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

// ─── Forecast Update Grid ─────────────────────────────────────────────────────

function ForecastUpdateGrid({ lines, onSaved, onCancel }: {
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

// ─── Inline Forecast Edit ─────────────────────────────────────────────────────

function InlineForecastEdit({ line, onSaved, onCancel }: {
  line: CornBudgetLineResponse; onSaved: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(String(line.forecastVolumeMt ?? line.budgetVolumeMt ?? ""));
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      await api.put(`/api/v1/corn/budget/${line.id}`, {
        forecastVolumeMt: parseFloat(value) || null,
        forecastNotes: noteText || null,
      });
      toast("Forecast updated", "success");
      onSaved();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Update failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input type="number" step="any" min="0" value={value}
        onChange={(e) => setValue(e.target.value)} autoFocus
        className="w-20 bg-slate-800 border border-slate-600 text-slate-200 text-right tabular-nums rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <input type="text" placeholder="Note" value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        className="w-24 bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none placeholder:text-slate-600" />
      <button onClick={handleSave} disabled={submitting}
        className="text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel}
        className="text-slate-500 hover:text-slate-300 transition-colors"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// ─── Forecast History Timeline ────────────────────────────────────────────────

function ForecastHistoryTimeline({ budgetLineId }: { budgetLineId: number }) {
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

// ─── Budget Line Row ──────────────────────────────────────────────────────────

function BudgetLineRow({ line, onEdit, onDeleted }: {
  line: CornBudgetLineResponse; onEdit: (l: CornBudgetLineResponse) => void; onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingForecast, setEditingForecast] = useState(false);
  const { toast } = useToast();

  async function handleDelete() {
    try {
      await api.delete(`/api/v1/corn/budget/${line.id}`);
      toast("Budget line deleted", "success");
      onDeleted();
    } catch { toast("Delete failed", "error"); }
  }

  const buVal = line.budgetVolumeBu ?? (line.budgetVolumeMt * BUSHELS_PER_MT);
  const notional = lineNotional(line);

  return (
    <>
      <tr className="hover:bg-slate-800/40 transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded((v) => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3 text-slate-300">{monthLabel(line.budgetMonth)}</td>
        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{line.futuresMonth ?? "\u2014"}</td>
        <td className="px-4 py-3 tabular-nums text-slate-200 text-right">{fmtVol(buVal)}</td>
        <td className="px-4 py-3 tabular-nums text-slate-500 text-right text-xs">{fmtVol(line.budgetVolumeMt)}</td>
        <td className="px-4 py-3 text-right">
          {line.targetAllInPerMt != null
            ? <span className="text-blue-400 font-semibold tabular-nums">${fmtPrice(line.targetAllInPerMt)}</span>
            : <span className="text-slate-600">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {notional != null
            ? <span className="text-emerald-400 tabular-nums text-xs">{fmtDollars(notional)}</span>
            : <span className="text-slate-600">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {editingForecast ? (
            <InlineForecastEdit line={line} onSaved={() => { setEditingForecast(false); onDeleted(); }} onCancel={() => setEditingForecast(false)} />
          ) : (
            <button onClick={() => setEditingForecast(true)} className="tabular-nums text-xs text-slate-300 hover:text-blue-400 transition-colors cursor-pointer">
              {line.forecastVolumeMt != null ? fmtVol(line.forecastVolumeMt) : "\u2014"}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {line.forecastVarianceMt != null ? (
            <span className={cn("tabular-nums text-xs font-medium",
              line.forecastVarianceMt < 0 ? "text-red-400" : line.forecastVarianceMt > 0 ? "text-green-400" : "text-slate-500")}>
              {line.forecastVarianceMt > 0 ? "+" : ""}{fmtVol(line.forecastVarianceMt)}
            </span>
          ) : <span className="text-slate-600 text-xs">&mdash;</span>}
        </td>
        <td className="px-4 py-3 tabular-nums text-slate-400 text-right text-xs">
          {line.hedgedVolumeMt != null ? fmtVol(line.hedgedVolumeMt) : "\u2014"}
        </td>
        <td className="px-4 py-3 text-center">
          {line.overHedged && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/10 ring-1 ring-orange-500/30 text-orange-400 text-xs font-medium">
              Over
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-slate-500 text-xs">{line.notes ?? ""}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => onEdit(line)} className="text-slate-600 hover:text-blue-400 transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            <button onClick={handleDelete} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={13} className="px-8 py-3 bg-slate-950/40 border-t border-slate-800/50">
            {line.components.length > 0 && (
              <div className="space-y-1">
                {line.components.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400 w-40">{c.componentName}</span>
                    <span className="text-slate-500 w-16">{c.unit}</span>
                    <span className="tabular-nums text-slate-300 w-20 text-right">{fmtPrice(c.targetValue)}</span>
                    <span className="tabular-nums text-slate-500 w-24 text-right">&asymp; ${fmtPrice(c.valuePerMt)}/MT</span>
                  </div>
                ))}
              </div>
            )}
            <ForecastHistoryTimeline budgetLineId={line.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FormMode = "none" | "single" | "fiscal-year" | "forecast-grid";
type Book = "CANADA" | "US";

export default function BudgetPage() {
  const { sites } = useSites();
  const { sites: adminSites } = useAdminSites();
  const { settings } = useAppSettings();
  const fyStartMonth = parseInt(settings.find((s) => s.settingKey === "FISCAL_YEAR_START_MONTH")?.value ?? "7") || 7;
  const [book, setBook] = useState<Book>("CANADA");
  const [filterSite, setFilterSite] = useState("");
  const [filterFY, setFilterFY]     = useState(() => currentFiscalYear(fyStartMonth));
  const { budget, isLoading, mutate } = useBudget(filterSite || undefined, filterFY || undefined);
  const [formMode, setFormMode]     = useState<FormMode>("none");
  const [editing, setEditing]       = useState<CornBudgetLineResponse | undefined>();

  // Map book to country for filtering
  const bookCountry = book === "CANADA" ? "Canada" : "US";

  // Filter sites by country from admin sites (which have the country field)
  const countrySites = useMemo(() => {
    return adminSites.filter((s) => s.country === bookCountry);
  }, [adminSites, bookCountry]);
  const countrySiteCodes = useMemo(() => new Set(countrySites.map((s) => s.code)), [countrySites]);

  function openEdit(line: CornBudgetLineResponse) { setEditing(line); setFormMode("single"); }
  function closeForm() { setFormMode("none"); setEditing(undefined); }
  function onSaved() { closeForm(); mutate(); }

  // Filter budget lines by country (only show lines for sites in the selected country)
  const filteredBudget = useMemo(() => {
    return budget.filter((l) => countrySiteCodes.has(l.siteCode));
  }, [budget, countrySiteCodes]);

  const bySite = filteredBudget.reduce<Record<string, CornBudgetLineResponse[]>>((acc, line) => {
    (acc[line.siteCode] ??= []).push(line);
    return acc;
  }, {});

  const totalBu = filteredBudget.reduce((s, l) => s + (l.budgetVolumeBu ?? l.budgetVolumeMt * BUSHELS_PER_MT), 0);
  const totalMt = filteredBudget.reduce((s, l) => s + l.budgetVolumeMt, 0);

  // Weighted average price
  const wtdAvg = useMemo(() => {
    let sumPriceVol = 0, sumVol = 0;
    for (const l of filteredBudget) {
      if (l.targetAllInPerMt != null && l.budgetVolumeMt > 0) {
        sumPriceVol += l.targetAllInPerMt * l.budgetVolumeMt;
        sumVol += l.budgetVolumeMt;
      }
    }
    if (sumVol === 0) return null;
    return sumPriceVol / sumVol;
  }, [filteredBudget]);

  // Total notional spend (with client-side fallback)
  const totalNotional = useMemo(() => {
    return filteredBudget.reduce((s, l) => s + (lineNotional(l) ?? 0), 0);
  }, [filteredBudget]);

  // Forecast vs Budget variance
  const totalForecastVariance = useMemo(() => {
    let total = 0;
    let hasForecast = false;
    for (const l of filteredBudget) {
      if (l.forecastVarianceMt != null) {
        total += l.forecastVarianceMt;
        hasForecast = true;
      }
    }
    return hasForecast ? total : null;
  }, [filteredBudget]);

  // Lines for the forecast grid (current site filter + fiscal year)
  const forecastGridLines = useMemo(() => {
    if (filterSite) return filteredBudget.filter((l) => l.siteCode === filterSite);
    return filteredBudget;
  }, [filteredBudget, filterSite]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Budgets &amp; Forecasts</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fiscal year starting {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][fyStartMonth - 1]} &middot; volume targets by site and month</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setFormMode("forecast-grid"); setEditing(undefined); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors">
            <RefreshCw className="h-4 w-4" /> Update Forecasts
          </button>
          <button onClick={() => { setFormMode("fiscal-year"); setEditing(undefined); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors">
            <CalendarDays className="h-4 w-4" /> Full Year
          </button>
          <button onClick={() => { setFormMode("single"); setEditing(undefined); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="h-4 w-4" /> Add Month
          </button>
        </div>
      </div>

      {/* Book toggle */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
          {(["CANADA", "US"] as Book[]).map((b) => (
            <button
              key={b}
              onClick={() => { setBook(b); setFilterSite(""); }}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                book === b
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {b === "CANADA" ? "\ud83c\udde8\ud83c\udde6 Canada" : "\ud83c\uddfa\ud83c\uddf8 United States"}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">All</option>
          {countrySites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
        <select value={filterFY} onChange={(e) => setFilterFY(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">All Fiscal Years</option>
          {availableFiscalYears(fyStartMonth).map((fy) => <option key={fy}>{fy}</option>)}
        </select>
      </div>

      {/* Forms */}
      {formMode === "single" && (
        <BudgetLineForm siteCode={filterSite || undefined} editing={editing} onSaved={onSaved} onCancel={closeForm} fyStartMonth={fyStartMonth} />
      )}
      {formMode === "fiscal-year" && (
        <FiscalYearGrid onSaved={onSaved} onCancel={closeForm} fyStartMonth={fyStartMonth} />
      )}
      {formMode === "forecast-grid" && forecastGridLines.length > 0 && (
        <ForecastUpdateGrid lines={forecastGridLines} onSaved={onSaved} onCancel={closeForm} />
      )}

      {/* KPIs */}
      {filteredBudget.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Budget Lines</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{filteredBudget.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Volume</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">
              {totalBu > 0 ? `${(totalBu / 1_000_000).toFixed(2)}M bu` : "\u2014"}
            </p>
            <p className="text-xs text-slate-400 tabular-nums mt-0.5">
              {totalMt > 0 ? `${fmtVol(Math.round(totalMt))} MT` : ""}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Wtd Avg Price</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">
              {wtdAvg != null ? `$${fmtPrice(wtdAvg)}/MT` : "\u2014"}
            </p>
            <p className="text-xs text-slate-400 tabular-nums mt-0.5">
              {wtdAvg != null ? `$${(wtdAvg / BUSHELS_PER_MT).toFixed(4)}/bu` : ""}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Notional</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">
              {totalNotional > 0 ? fmtDollars(totalNotional) : "\u2014"}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Forecast vs Budget</p>
            <p className={cn("text-2xl font-bold tabular-nums",
              totalForecastVariance == null ? "text-slate-100"
              : totalForecastVariance < 0 ? "text-red-400"
              : totalForecastVariance > 0 ? "text-green-400"
              : "text-slate-100")}>
              {totalForecastVariance != null
                ? `${totalForecastVariance > 0 ? "+" : ""}${fmtVol(Math.round(totalForecastVariance))} MT`
                : "\u2014"}
            </p>
          </div>
        </div>
      )}

      {/* Table grouped by site */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={13} />
      ) : filteredBudget.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No budget lines"
          description='Use "Full Year" to enter an entire fiscal year at once, or "Add Month" for a single month.'
          action={{ label: "Full Year Entry", onClick: () => setFormMode("fiscal-year") }}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(bySite).map(([siteCode, lines]) => {
            const siteName = lines[0]?.siteName ?? siteCode;
            const siteBu   = lines.reduce((s, l) => s + (l.budgetVolumeBu ?? l.budgetVolumeMt * BUSHELS_PER_MT), 0);
            const siteMt   = lines.reduce((s, l) => s + l.budgetVolumeMt, 0);
            // Weighted price for site
            let siteSumPriceVol = 0, siteSumVol = 0;
            for (const l of lines) {
              if (l.targetAllInPerMt != null && l.budgetVolumeMt > 0) {
                siteSumPriceVol += l.targetAllInPerMt * l.budgetVolumeMt;
                siteSumVol += l.budgetVolumeMt;
              }
            }
            const siteWtdAvg = siteSumVol > 0 ? siteSumPriceVol / siteSumVol : null;
            const siteNotional = lines.reduce((s, l) => s + (lineNotional(l) ?? 0), 0);
            // Subtotals for new columns
            const siteForecastMt = lines.reduce((s, l) => s + (l.forecastVolumeMt ?? 0), 0);
            const siteVarianceMt = lines.reduce((s, l) => s + (l.forecastVarianceMt ?? 0), 0);
            const siteHedgedMt   = lines.reduce((s, l) => s + (l.hedgedVolumeMt ?? 0), 0);
            const hasForecasts   = lines.some((l) => l.forecastVolumeMt != null);
            const hasVariance    = lines.some((l) => l.forecastVarianceMt != null);

            return (
              <div key={siteCode} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-slate-200">{siteName}</span>
                    <span className="ml-2 text-xs text-slate-500">{siteCode}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>{fmtVol(siteBu)} bu</span>
                    <span className="text-slate-600">&middot;</span>
                    <span>{fmtVol(siteMt)} MT</span>
                    <span className="text-slate-600">&middot;</span>
                    <span>{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
                    {siteWtdAvg != null && (
                      <>
                        <span className="text-slate-600">&middot;</span>
                        <span className="text-blue-400">${fmtPrice(siteWtdAvg)}/MT</span>
                        <span className="text-slate-500">(${(siteWtdAvg / BUSHELS_PER_MT).toFixed(4)}/bu)</span>
                      </>
                    )}
                    {siteNotional > 0 && (
                      <>
                        <span className="text-slate-600">&middot;</span>
                        <span className="text-emerald-400">{fmtDollars(siteNotional)} notional</span>
                      </>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/20 border-b border-slate-800">
                      <th className="w-8" />
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Month</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Futures Ref</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Bushels</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">MT</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">All-in $/MT</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Notional $</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Fcst MT</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Variance</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Hedged MT</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {lines.map((line) => (
                      <BudgetLineRow key={line.id} line={line} onEdit={openEdit} onDeleted={mutate} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-800/30">
                      <td colSpan={3} className="px-4 py-2 text-xs text-slate-500 text-right font-medium">Subtotal</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-300 text-xs">{fmtVol(siteBu)} bu</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-400 text-xs">{fmtVol(siteMt)} MT</td>
                      <td />
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-400 text-xs font-medium">{siteNotional > 0 ? fmtDollars(siteNotional) : ""}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-400 text-xs">{hasForecasts ? fmtVol(siteForecastMt) : ""}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs font-medium">
                        {hasVariance ? (
                          <span className={siteVarianceMt < 0 ? "text-red-400" : siteVarianceMt > 0 ? "text-green-400" : "text-slate-500"}>
                            {siteVarianceMt > 0 ? "+" : ""}{fmtVol(siteVarianceMt)}
                          </span>
                        ) : ""}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-400 text-xs">{siteHedgedMt > 0 ? fmtVol(siteHedgedMt) : ""}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
