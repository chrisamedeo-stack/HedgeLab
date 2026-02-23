"use client";

import { useState } from "react";
import { CornBudgetLineResponse, useSites } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import {
  BUSHELS_PER_MT,
  suggestFuturesMonth,
  deriveFiscalYear,
} from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { COMMODITY_OPTIONS, ComponentRow } from "./shared";
import { ComponentEditor } from "./component-editor";

export function BudgetLineForm({ siteCode: defaultSite, onSaved, onCancel, editing, fyStartMonth = 7 }: {
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
    budgetVolumeMt: editing?.budgetVolumeMt != null ? String(editing.budgetVolumeMt) : "",
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
  const mtVal = buVal / BUSHELS_PER_MT;
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
          <label className="text-xs text-slate-400">Volume (bushels)</label>
          <input type="number" step="1" min="0" placeholder="e.g. 196,842"
            value={form.budgetVolumeBu} onChange={(e) => field("budgetVolumeBu", e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
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
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Notes</label>
        <input type="text" placeholder="Optional" value={form.notes} onChange={(e) => field("notes", e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
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
