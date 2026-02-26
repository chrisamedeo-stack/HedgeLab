"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { today, inputCls, btnPrimary, btnCancel } from "@/lib/corn-format";
import { cn } from "@/lib/utils";

interface SettlePublisherProps {
  futuresMonths: string[];
  existingSettles: Record<string, number>;
  onDone: () => void;
}

export function SettlePublisher({ futuresMonths, existingSettles, onDone }: SettlePublisherProps) {
  const toast = useToast();
  const [settleDate, setSettleDate] = useState(today());
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    futuresMonths.forEach((fm) => {
      init[fm] = existingSettles[fm] != null ? String(existingSettles[fm]) : "";
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const payload: Record<string, number> = {};
    for (const [fm, v] of Object.entries(prices)) {
      const n = parseFloat(v);
      if (!isNaN(n)) payload[fm] = n;
    }
    if (Object.keys(payload).length === 0) {
      toast.toast("Enter at least one settle price", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/v1/corn/positions/settle", { settleDate, prices: payload });
      toast.toast("Settle prices published", "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Failed to publish", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-input-bg border border-b-input rounded-lg p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-semibold text-secondary">Publish Settle Prices</span>
        <span className="text-xs text-faint">Enter ZC close prices ($/bu)</span>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Settle Date</label>
          <input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className={inputCls} />
        </div>
        {futuresMonths.map((fm) => (
          <div key={fm} className="flex flex-col gap-1">
            <label className="text-xs text-faint">{fm} ($/bu)</label>
            <input
              type="number"
              step="0.25"
              placeholder={existingSettles[fm] != null ? String(existingSettles[fm]) : "e.g. 4.39"}
              value={prices[fm] ?? ""}
              onChange={(e) => setPrices((p) => ({ ...p, [fm]: e.target.value }))}
              className={cn(inputCls, "w-36")}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Saving\u2026" : "Publish"}
        </button>
        <button onClick={onDone} className={btnCancel}>Cancel</button>
      </div>
    </div>
  );
}
