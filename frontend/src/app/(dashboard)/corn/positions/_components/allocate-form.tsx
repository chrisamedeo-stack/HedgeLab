"use client";

import { useState } from "react";
import { ArrowRightLeft, Plus, X } from "lucide-react";
import type { HedgeBookItem } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { fmtBu, inputCls, btnPrimary, btnSecondary } from "@/lib/corn-format";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";
import type { SiteOption } from "./shared";

interface AllocRow {
  budgetMonth: string;
  siteCode: string;
  bushels: string;
}

interface AllocateFormProps {
  hedge: HedgeBookItem;
  sites: SiteOption[];
  onDone: () => void;
  onCancel: () => void;
}

export function AllocateForm({ hedge, sites, onDone, onCancel }: AllocateFormProps) {
  const toast = useToast();
  const validMonths = hedge.validDeliveryMonths;
  const [rows, setRows] = useState<AllocRow[]>([
    { budgetMonth: validMonths[0] ?? "", siteCode: "", bushels: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const totalBu = rows.reduce((s, r) => s + (parseInt(r.bushels) || 0), 0);
  const availBu = hedge.unallocatedBushels;

  function updateRow(idx: number, field: keyof AllocRow, val: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { budgetMonth: validMonths[0] ?? "", siteCode: "", bushels: "" }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (totalBu <= 0 || totalBu > availBu) {
      toast.toast(`Total bushels must be 1\u2013${fmtBu(availBu)}`, "error");
      return;
    }
    for (const row of rows) {
      const bu = parseInt(row.bushels);
      if (bu > 0 && !row.budgetMonth) {
        toast.toast("Budget month is required for each row", "error");
        return;
      }
    }
    setSaving(true);
    try {
      for (const row of rows) {
        const bu = parseInt(row.bushels);
        if (!bu || bu <= 0) continue;
        const lots = Math.round(bu / 5000);
        if (lots <= 0) continue;
        await api.post(`/api/v1/corn/hedges/${hedge.hedgeTradeId}/allocations`, {
          siteCode: row.siteCode || null,
          budgetMonth: row.budgetMonth,
          allocatedLots: lots,
        });
      }
      toast.toast(`Allocated ${fmtBu(totalBu)} bu from ${hedge.tradeRef}`, "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Allocation failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-input-bg border border-profit-30 rounded-lg p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="h-4 w-4 text-profit" />
        <span className="text-sm font-semibold text-profit">
          Allocate &middot; {hedge.tradeRef} ({hedge.futuresMonth})
        </span>
        <span className="ml-auto text-xs text-faint">{fmtBu(availBu)} bu available</span>
      </div>

      <div className="space-y-2 mb-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-faint">Budget Month</label>
              <select value={row.budgetMonth} onChange={(e) => updateRow(idx, "budgetMonth", e.target.value)} className={inputCls}>
                {validMonths.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-faint">Site <span className="text-ph">(optional)</span></label>
              <select value={row.siteCode} onChange={(e) => updateRow(idx, "siteCode", e.target.value)} className={inputCls}>
                <option value="">&middot;</option>
                {sites.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} &middot; {s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-faint">Bushels</label>
              <input
                type="number"
                step={5000}
                min={5000}
                placeholder="e.g. 25000"
                value={row.bushels}
                onChange={(e) => updateRow(idx, "bushels", e.target.value)}
                className={cn(inputCls, "w-36")}
              />
            </div>
            <div className="text-xs text-faint pb-1.5">
              {row.bushels ? `${Math.round(parseInt(row.bushels) / 5000)} lots` : ""}
            </div>
            {rows.length > 1 && (
              <button onClick={() => removeRow(idx)} className="pb-1.5 text-faint hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <button onClick={addRow} className="flex items-center gap-1 text-xs text-profit hover:text-profit">
          <Plus className="h-3 w-3" /> Add Row
        </button>
        <span className={cn("text-xs font-medium", totalBu > availBu ? "text-loss" : "text-muted")}>
          Total: {fmtBu(totalBu)} / {fmtBu(availBu)} bu
        </span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving || totalBu <= 0 || totalBu > availBu} className={btnPrimary}>
          {saving ? "Allocating\u2026" : "Allocate"}
        </button>
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}
