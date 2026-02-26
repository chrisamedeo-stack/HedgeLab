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
    onChange(rows.map((r) => {
      if (r.key !== key) return r;
      if (field === "unit") {
        return { ...r, unit: value };
      }
      return { ...r, [field]: value };
    }));
  }
  function removeRow(key: number) { onChange(rows.filter((r) => r.key !== key)); }
  function addPreset(p: { name: string; unit: string }) {
    onChange([...rows, { key: Date.now(), componentName: p.name, unit: p.unit, targetValue: "", displayOrder: rows.length + 1 }]);
  }

  const totalPerBu = rows.reduce((sum, r) => {
    const val = parseFloat(r.targetValue);
    if (isNaN(val)) return sum;
    return sum + (r.unit === "$/bu" ? val : val / BUSHELS_PER_MT);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-faint self-center">Quick add:</span>
        {PRESET_COMPONENTS.map((p) => (
          <button key={p.name} type="button" onClick={() => addPreset(p)}
            className="px-2 py-0.5 bg-input-bg hover:bg-hover text-secondary text-xs rounded border border-b-input transition-colors">
            {p.name}
          </button>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="rounded-lg border border-b-input overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg/60">
                <th className="px-3 py-2 text-left text-xs text-faint font-medium">Component</th>
                <th className="px-3 py-2 text-left text-xs text-faint font-medium w-28">Unit</th>
                <th className="px-3 py-2 text-right text-xs text-faint font-medium w-32">Target Value</th>
                <th className="px-3 py-2 text-right text-xs text-faint font-medium w-28">&asymp; $/bu</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {rows.map((r) => {
                const val = parseFloat(r.targetValue);
                const perBu = isNaN(val) ? null : r.unit === "$/bu" ? val : val / BUSHELS_PER_MT;
                return (
                  <tr key={r.key} className="hover:bg-row-hover">
                    <td className="px-3 py-1.5">
                      <input type="text" value={r.componentName} onChange={(e) => updateRow(r.key, "componentName", e.target.value)}
                        placeholder="e.g. Basis" className="w-full bg-transparent text-secondary placeholder:text-ph focus:outline-none" />
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={r.unit} onChange={(e) => updateRow(r.key, "unit", e.target.value)}
                        className="bg-input-bg border border-b-input text-secondary text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-focus w-full">
                        {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                        {!UNIT_OPTIONS.includes(r.unit) && <option value={r.unit}>{r.unit}</option>}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input type="number" step="any" value={r.targetValue} onChange={(e) => updateRow(r.key, "targetValue", e.target.value)}
                        className="w-full bg-transparent text-secondary text-right placeholder:text-ph focus:outline-none tabular-nums" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted tabular-nums text-xs">
                      {perBu != null ? perBu.toFixed(4) : "\u2014"}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <button type="button" onClick={() => removeRow(r.key)} className="text-ph hover:text-destructive transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-tbl-header border-t border-b-input">
                <td colSpan={3} className="px-3 py-2 text-xs text-faint text-right font-medium">All-in target</td>
                <td className="px-3 py-2 text-right font-bold text-action tabular-nums text-sm">
                  {totalPerBu > 0 ? `$${totalPerBu.toFixed(4)}` : "\u2014"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <button type="button" onClick={() => onChange([...rows, { key: Date.now(), componentName: "", unit: "$/bu", targetValue: "", displayOrder: rows.length + 1 }])}
        className="flex items-center gap-1.5 text-xs text-faint hover:text-secondary transition-colors mt-1">
        <Plus className="h-3.5 w-3.5" /> Add custom component
      </button>
    </div>
  );
}

// ─── Component Token Bar ──────────────────────────────────────────────────────

export function ComponentTokenBar({ rows }: { rows: ComponentRow[] }) {
  const filled = rows.filter((r) => r.componentName && r.targetValue && !isNaN(parseFloat(r.targetValue)));
  if (filled.length === 0) return null;
  const totalPerBu = filled.reduce((sum, r) => {
    const val = parseFloat(r.targetValue);
    return sum + (r.unit === "$/bu" ? val : val / BUSHELS_PER_MT);
  }, 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {filled.map((r, i) => (
        <Fragment key={r.key}>
          {i > 0 && <span className="text-ph text-xs">+</span>}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-action-10 ring-1 ring-action-20 text-action text-xs tabular-nums">
            {r.componentName}: {parseFloat(r.targetValue).toFixed(2)} {r.unit}
          </span>
        </Fragment>
      ))}
      <span className="text-ph text-xs">=</span>
      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-profit-10 ring-1 ring-profit-20 text-profit text-xs font-medium tabular-nums">
        ${totalPerBu.toFixed(4)}/bu
      </span>
    </div>
  );
}
