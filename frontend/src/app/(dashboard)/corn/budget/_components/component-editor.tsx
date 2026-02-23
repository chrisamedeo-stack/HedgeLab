"use client";

import { Fragment } from "react";
import { Plus, X } from "lucide-react";
import { BUSHELS_PER_MT } from "@/lib/corn-utils";
import {
  PRESET_COMPONENTS,
  UNIT_OPTIONS,
  ComponentRow,
  fmtPrice,
} from "./shared";

// ─── Component Editor ─────────────────────────────────────────────────────────

export function ComponentEditor({ rows, onChange }: { rows: ComponentRow[]; onChange: (r: ComponentRow[]) => void }) {
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

export function ComponentTokenBar({ rows }: { rows: ComponentRow[] }) {
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
