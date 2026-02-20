"use client";

import { Fragment, useState } from "react";
import {
  BookOpen, Plus, Edit2, Trash2, X,
  ChevronDown, ChevronRight, CalendarDays,
} from "lucide-react";
import {
  useBudget, useSites,
  CornBudgetLineResponse,
} from "@/hooks/useCorn";
import { useAppSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

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
const BUSHELS_PER_MT = 39.3683;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function suggestFuturesMonth(budgetMonth: string): string {
  if (!budgetMonth || budgetMonth.length < 7) return "";
  const year  = parseInt(budgetMonth.slice(0, 4));
  const month = parseInt(budgetMonth.slice(5, 7));
  const yy = (y: number) => String(y).slice(-2);
  if (month <= 2)  return `ZCH${yy(year)}`;
  if (month <= 4)  return `ZCK${yy(year)}`;
  if (month <= 6)  return `ZCN${yy(year)}`;
  if (month <= 8)  return `ZCU${yy(year)}`;
  if (month <= 11) return `ZCZ${yy(year)}`;
  return `ZCH${yy(year + 1)}`;
}

/** Configurable fiscal year derivation */
function deriveFiscalYear(budgetMonth: string, fyStartMonth = 7): string {
  if (!budgetMonth) return "";
  const year  = parseInt(budgetMonth.slice(0, 4));
  const month = parseInt(budgetMonth.slice(5, 7));
  const start = month >= fyStartMonth ? year : year - 1;
  return `${start}/${start + 1}`;
}

/** All 12 months of a configurable FY */
function fiscalYearMonths(fy: string, fyStartMonth = 7): string[] {
  if (!fy.includes("/")) return [];
  const sy = parseInt(fy.split("/")[0]);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((fyStartMonth - 1 + i) % 12) + 1;
    const y = m >= fyStartMonth ? sy : sy + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

function availableFiscalYears(fyStartMonth = 7): string[] {
  const now = new Date();
  const y = now.getMonth() + 1 >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 7 }, (_, i) => `${y - 2 + i}/${y - 1 + i}`);
}

function fmtVol(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function monthLabel(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
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
                <th className="px-3 py-2 text-right text-xs text-slate-500 font-medium w-28">≈ $/MT</th>
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
                      {perMt != null ? fmtPrice(perMt) : "—"}
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
                  {totalPerMt > 0 ? `$${fmtPrice(totalPerMt)}` : "—"}
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
  const [form, setForm] = useState({
    siteCode:      editing?.siteCode ?? defaultSite ?? "",
    commodityCode: editing?.commodityCode ?? "CORN-ZC",
    budgetMonth:   editing?.budgetMonth ?? "",
    futuresMonth:  editing?.futuresMonth ?? "",
    budgetVolumeBu: editing?.budgetVolumeBu != null ? String(editing.budgetVolumeBu)
      : editing?.budgetVolumeMt != null ? String(Math.round(editing.budgetVolumeMt * BUSHELS_PER_MT)) : "",
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

  const buVal = parseFloat(form.budgetVolumeBu) || 0;
  const mtVal = buVal > 0 ? buVal / BUSHELS_PER_MT : 0;
  const fiscalYear = deriveFiscalYear(form.budgetMonth, fyStartMonth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        siteCode: form.siteCode, commodityCode: form.commodityCode,
        budgetMonth: form.budgetMonth, futuresMonth: form.futuresMonth || null,
        budgetVolumeBu: buVal || null, budgetVolumeMt: mtVal || null,
        fiscalYear: fiscalYear || null, notes: form.notes || null,
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
            <option value="">— Select —</option>
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
          <label className="text-xs text-slate-400">Volume (bushels)</label>
          <input type="number" step="1" min="0" placeholder="e.g. 196,842"
            value={form.budgetVolumeBu} onChange={(e) => field("budgetVolumeBu", e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">MT equivalent (auto)</label>
          <div className="bg-slate-800/50 border border-slate-700/50 text-slate-400 rounded-lg px-3 py-2 text-sm tabular-nums">
            {mtVal > 0 ? `${mtVal.toLocaleString("en-US", { maximumFractionDigits: 1 })} MT` : "—"}
          </div>
        </div>
      </div>
      {form.budgetMonth && (
        <p className="text-xs text-slate-500">
          Fiscal year: <span className="text-slate-300 font-medium">{fiscalYear}</span>
          {form.futuresMonth && <> · Futures: <span className="text-blue-400 font-medium">{form.futuresMonth}</span></>}
        </p>
      )}
      <div className="space-y-2">
        <label className="text-xs text-slate-400 block">Cost Components (optional)</label>
        <ComponentEditor rows={components} onChange={setComponents} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Notes</label>
        <input type="text" placeholder="Optional" value={form.notes} onChange={(e) => field("notes", e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? "Saving…" : editing ? "Update" : "Create"}
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
  const [config, setConfig] = useState({ siteCode: "", commodityCode: "CORN-ZC", fiscalYear: availableFiscalYears(fyStartMonth)[2] });
  const [components, setComponents] = useState<ComponentRow[]>([]);
  type MRow = { budgetVolumeBu: string; futuresMonth: string; notes: string };
  const mkRows = (fy: string) =>
    Object.fromEntries(fiscalYearMonths(fy, fyStartMonth).map((m) => [m, { budgetVolumeBu: "", futuresMonth: suggestFuturesMonth(m), notes: "" }]));
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
  function applyAll(v: string) { setRows((r) => Object.fromEntries(Object.entries(r).map(([m, row]) => [m, { ...row, budgetVolumeBu: v }]))); }

  const months = fiscalYearMonths(config.fiscalYear, fyStartMonth);
  const totalBu = months.reduce((s, m) => s + (parseFloat(rows[m]?.budgetVolumeBu) || 0), 0);
  const totalMt = totalBu / BUSHELS_PER_MT;
  const filledCount = months.filter((m) => parseFloat(rows[m]?.budgetVolumeBu) > 0).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config.siteCode) { toast("Select a site", "error"); return; }
    const sharedComponentPayload = components
      .map((r, i) => ({ componentName: r.componentName, unit: r.unit, targetValue: parseFloat(r.targetValue), displayOrder: i + 1 }))
      .filter((c) => c.componentName && !isNaN(c.targetValue));
    const lines = months.filter((m) => parseFloat(rows[m]?.budgetVolumeBu) > 0).map((m) => {
      const bu = parseFloat(rows[m].budgetVolumeBu);
      return { siteCode: config.siteCode, commodityCode: config.commodityCode, budgetMonth: m,
        futuresMonth: rows[m].futuresMonth || null, budgetVolumeBu: bu, budgetVolumeMt: bu / BUSHELS_PER_MT,
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
            <option value="">— Select —</option>
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
          <input type="number" placeholder="bushels" step="1" min="0"
            className="w-32 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
            onChange={(e) => applyAll(e.target.value)} />
          <span className="text-xs text-slate-600">bu/month</span>
        </div>
        <p className="text-xs text-slate-600">Sets all months — override individually below</p>
      </div>
      {/* Monthly Grid */}
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700">
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium w-20">Month</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium">Bushels</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-28">MT (auto)</th>
              <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium w-36">All-in</th>
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium w-28">Futures Ref</th>
              <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {months.map((m) => {
              const row = rows[m] ?? { budgetVolumeBu: "", futuresMonth: "", notes: "" };
              const bu  = parseFloat(row.budgetVolumeBu) || 0;
              const mt  = bu > 0 ? bu / BUSHELS_PER_MT : 0;
              return (
                <tr key={m} className={m.endsWith("-07") ? "border-t-2 border-blue-500/30" : ""}>
                  <td className="px-3 py-2 font-medium text-slate-300 whitespace-nowrap">{monthLabel(m)}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="1" min="0" placeholder="0" value={row.budgetVolumeBu}
                      onChange={(e) => updateRow(m, "budgetVolumeBu", e.target.value)}
                      className="w-full bg-transparent text-slate-200 text-right tabular-nums placeholder:text-slate-700 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500 text-xs">
                    {mt > 0 ? mt.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {sharedTotalPerMt > 0 ? (
                      <div>
                        <span className="text-blue-400">${sharedTotalDollarsBu.toFixed(2)}/bu</span>
                        <br />
                        <span className="text-slate-500">${fmtPrice(sharedTotalPerMt)}/MT</span>
                      </div>
                    ) : <span className="text-slate-700">—</span>}
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
                {totalBu > 0 ? totalBu.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-400 text-xs">
                {totalMt > 0 ? totalMt.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
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
          {submitting ? "Saving…" : `Save ${filledCount} month${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}

// ─── Budget Line Row ──────────────────────────────────────────────────────────

function BudgetLineRow({ line, onEdit, onDeleted }: {
  line: CornBudgetLineResponse; onEdit: (l: CornBudgetLineResponse) => void; onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  async function handleDelete() {
    try {
      await api.delete(`/api/v1/corn/budget/${line.id}`);
      toast("Budget line deleted", "success");
      onDeleted();
    } catch { toast("Delete failed", "error"); }
  }

  const buVal = line.budgetVolumeBu ?? (line.budgetVolumeMt * BUSHELS_PER_MT);

  return (
    <>
      <tr className="hover:bg-slate-800/40 transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded((v) => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3 text-slate-300">{monthLabel(line.budgetMonth)}</td>
        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{line.futuresMonth ?? "—"}</td>
        <td className="px-4 py-3 tabular-nums text-slate-200 text-right">{fmtVol(buVal)}</td>
        <td className="px-4 py-3 tabular-nums text-slate-500 text-right text-xs">{fmtVol(line.budgetVolumeMt)}</td>
        <td className="px-4 py-3 text-right">
          {line.targetAllInPerMt != null
            ? <span className="text-blue-400 font-semibold tabular-nums">${fmtPrice(line.targetAllInPerMt)}</span>
            : <span className="text-slate-600">—</span>}
        </td>
        <td className="px-4 py-3 text-slate-500 text-xs">{line.notes ?? ""}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => onEdit(line)} className="text-slate-600 hover:text-blue-400 transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            <button onClick={handleDelete} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </td>
      </tr>
      {expanded && line.components.length > 0 && (
        <tr>
          <td colSpan={8} className="px-8 py-3 bg-slate-950/40 border-t border-slate-800/50">
            <div className="space-y-1">
              {line.components.map((c) => (
                <div key={c.id} className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400 w-40">{c.componentName}</span>
                  <span className="text-slate-500 w-16">{c.unit}</span>
                  <span className="tabular-nums text-slate-300 w-20 text-right">{fmtPrice(c.targetValue)}</span>
                  <span className="tabular-nums text-slate-500 w-24 text-right">≈ ${fmtPrice(c.valuePerMt)}/MT</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FormMode = "none" | "single" | "fiscal-year";

export default function BudgetPage() {
  const { sites } = useSites();
  const { settings } = useAppSettings();
  const fyStartMonth = parseInt(settings.find((s) => s.settingKey === "FISCAL_YEAR_START_MONTH")?.value ?? "7") || 7;
  const [filterSite, setFilterSite] = useState("");
  const [filterFY, setFilterFY]     = useState("");
  const { budget, isLoading, mutate } = useBudget(filterSite || undefined, filterFY || undefined);
  const [formMode, setFormMode]     = useState<FormMode>("none");
  const [editing, setEditing]       = useState<CornBudgetLineResponse | undefined>();

  function openEdit(line: CornBudgetLineResponse) { setEditing(line); setFormMode("single"); }
  function closeForm() { setFormMode("none"); setEditing(undefined); }
  function onSaved() { closeForm(); mutate(); }

  const bySite = budget.reduce<Record<string, CornBudgetLineResponse[]>>((acc, line) => {
    (acc[line.siteCode] ??= []).push(line);
    return acc;
  }, {});

  const totalBu = budget.reduce((s, l) => s + (l.budgetVolumeBu ?? l.budgetVolumeMt * BUSHELS_PER_MT), 0);
  const totalMt = budget.reduce((s, l) => s + l.budgetVolumeMt, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Procurement Budget</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fiscal year starting {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][fyStartMonth - 1]} · volume targets by site and month</p>
        </div>
        <div className="flex gap-2">
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">All Sites</option>
          {sites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
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

      {/* KPIs */}
      {budget.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Budget Lines",  value: String(budget.length) },
            { label: "Total Bushels", value: totalBu > 0 ? `${(totalBu / 1_000_000).toFixed(2)}M bu` : "—" },
            { label: "Total MT",      value: totalMt > 0 ? `${fmtVol(Math.round(totalMt))} MT` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-100">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table grouped by site */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : budget.length === 0 ? (
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
            return (
              <div key={siteCode} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-slate-200">{siteName}</span>
                    <span className="ml-2 text-xs text-slate-500">{siteCode}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>{fmtVol(siteBu)} bu</span>
                    <span className="text-slate-600">·</span>
                    <span>{fmtVol(siteMt)} MT</span>
                    <span className="text-slate-600">·</span>
                    <span>{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
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
