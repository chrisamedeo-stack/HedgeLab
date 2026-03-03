"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RateTable } from "@/types/pricing";

const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";
const selectCls = inputCls;
const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50";
const btnCancel = "inline-flex items-center gap-2 rounded-lg bg-input-bg px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors border border-b-input";

interface Props {
  initial?: RateTable | null;
  commodities: { id: string; name: string }[];
  saving: boolean;
  onSave: (data: {
    name: string; rateType: string; commodityId: string | null;
    rates: Record<string, number>;
    effectiveDate: string | null; expiryDate: string | null;
  }) => void;
  onCancel: () => void;
}

export function RateTableEditor({ initial, commodities, saving, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rateType, setRateType] = useState(initial?.rate_type ?? "flat");
  const [commodityId, setCommodityId] = useState(initial?.commodity_id ?? "");
  const [effectiveDate, setEffectiveDate] = useState(initial?.effective_date ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiry_date ?? "");

  // Key-value rates
  const initRates = initial?.rates ?? {};
  const [rows, setRows] = useState<{ key: string; value: number }[]>(
    Object.entries(initRates).map(([key, value]) => ({ key, value }))
  );

  function addRow() {
    setRows((r) => [...r, { key: "", value: 0 }]);
  }

  function updateRow(idx: number, field: "key" | "value", val: string) {
    setRows((r) => r.map((row, i) =>
      i === idx ? { ...row, [field]: field === "value" ? Number(val) : val } : row
    ));
  }

  function deleteRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rates: Record<string, number> = {};
    for (const row of rows) {
      if (row.key.trim()) rates[row.key.trim()] = row.value;
    }
    onSave({
      name,
      rateType,
      commodityId: commodityId || null,
      rates,
      effectiveDate: effectiveDate || null,
      expiryDate: expiryDate || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">Name</label>
          <input type="text" required className={inputCls} placeholder="e.g. Elevation Rates"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Rate Type</label>
          <select className={selectCls} value={rateType} onChange={(e) => setRateType(e.target.value)}>
            <option value="flat">Flat</option>
            <option value="tiered">Tiered</option>
            <option value="zone">Zone</option>
            <option value="seasonal">Seasonal</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Commodity</label>
          <select className={selectCls} value={commodityId} onChange={(e) => setCommodityId(e.target.value)}>
            <option value="">All commodities</option>
            {commodities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">Effective Date</label>
          <input type="date" className={inputCls} value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Expiry Date</label>
          <input type="date" className={inputCls} value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted font-medium">Rates</label>
          <button type="button" onClick={addRow} className="text-xs text-action hover:text-action-hover flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Row
          </button>
        </div>

        {rows.length === 0 && (
          <p className="text-xs text-faint py-3 text-center">No rates defined. Click &quot;Add Row&quot; to start.</p>
        )}

        <div className="space-y-1">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="text" className={`${inputCls} flex-1`} placeholder="Key (e.g. zone_a)"
                value={row.key} onChange={(e) => updateRow(idx, "key", e.target.value)} />
              <input type="number" step="any" className={`${inputCls} w-32`} placeholder="Rate"
                value={row.value} onChange={(e) => updateRow(idx, "value", e.target.value)} />
              <button type="button" onClick={() => deleteRow(idx)}
                className="p-1.5 text-ph hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className={btnCancel}>Cancel</button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : initial ? "Update Rate Table" : "Create Rate Table"}
        </button>
      </div>
    </form>
  );
}
