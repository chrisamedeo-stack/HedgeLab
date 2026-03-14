"use client";

import { useState, useCallback } from "react";
import { usePositionStore } from "@/store/positionStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatContractMonth } from "@/lib/commodity-utils";

interface AllocationRow {
  key: string;
  siteId: string;
  budgetMonth: string;
  volume: string;
}

interface TradeAllocateFormProps {
  tradeId: string;
  orgId: string;
  commodityId: string;
  direction: "long" | "short";
  contractMonth: string;
  tradePrice: number;
  tradeDate: string;
  currency: string;
  remainingVolume: number;
  sites: { id: string; name: string; code: string }[];
  onSuccess: () => void;
}

export function TradeAllocateForm({
  tradeId,
  orgId,
  commodityId,
  direction,
  contractMonth,
  tradePrice,
  tradeDate,
  currency,
  remainingVolume,
  sites,
  onSuccess,
}: TradeAllocateFormProps) {
  const { allocate } = usePositionStore();
  const { user } = useAuth();
  const [rows, setRows] = useState<AllocationRow[]>([
    { key: "1", siteId: sites[0]?.id ?? "", budgetMonth: "", volume: String(remainingVolume) },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAllocated = rows.reduce((sum, r) => sum + (Number(r.volume) || 0), 0);
  const overAllocated = totalAllocated > remainingVolume;

  const updateRow = useCallback((key: string, field: keyof AllocationRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }, []);

  const addRow = useCallback(() => {
    const remaining = remainingVolume - totalAllocated;
    setRows((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        siteId: sites[0]?.id ?? "",
        budgetMonth: "",
        volume: String(Math.max(0, remaining)),
      },
    ]);
  }, [remainingVolume, totalAllocated, sites]);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const handleSubmit = async () => {
    setError(null);

    // Validate
    for (const row of rows) {
      if (!row.siteId) { setError("Select a site for each row"); return; }
      if (!row.budgetMonth) { setError("Select a budget month for each row"); return; }
      if (!Number(row.volume) || Number(row.volume) <= 0) { setError("Volume must be > 0"); return; }
    }
    if (overAllocated) { setError("Total exceeds remaining volume"); return; }

    setSubmitting(true);
    try {
      for (const row of rows) {
        await allocate({
          orgId,
          userId: user!.id,
          tradeId,
          siteId: row.siteId,
          commodityId,
          allocatedVolume: Number(row.volume),
          budgetMonth: row.budgetMonth,
          tradePrice,
          tradeDate,
          contractMonth,
          direction,
          currency,
        });
      }
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate month options (current month + 24 forward)
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="rounded-lg border border-b-default bg-surface p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Allocate to Sites</h4>
        <span className="text-xs text-faint">
          {totalAllocated.toLocaleString()} of {remainingVolume.toLocaleString()} MT
        </span>
      </div>

      {/* Pre-filled trade info */}
      <div className="flex flex-wrap gap-4 text-xs text-faint bg-input-bg/50 rounded px-3 py-2">
        <span><span className="text-muted">Direction:</span> <span className={direction === "long" ? "text-profit" : "text-loss"}>{direction}</span></span>
        <span><span className="text-muted">Contract:</span> {formatContractMonth(contractMonth)}</span>
        <span><span className="text-muted">Price:</span> ${tradePrice.toFixed(4)}/bu</span>
        <span><span className="text-muted">Currency:</span> {currency}</span>
      </div>

      {/* Allocation rows */}
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row.key} className="flex items-center gap-2">
            {/* Site */}
            <select
              value={row.siteId}
              onChange={(e) => updateRow(row.key, "siteId", e.target.value)}
              className="flex-1 min-w-0 rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="">Site...</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>

            {/* Budget Month */}
            <select
              value={row.budgetMonth}
              onChange={(e) => updateRow(row.key, "budgetMonth", e.target.value)}
              className="w-36 rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="">Month...</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Volume */}
            <input
              type="number"
              value={row.volume}
              onChange={(e) => updateRow(row.key, "volume", e.target.value)}
              placeholder="Volume"
              className="w-28 rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary tabular-nums text-right focus:border-focus focus:outline-none"
            />

            {/* Remove */}
            {rows.length > 1 && (
              <button
                onClick={() => removeRow(row.key)}
                className="text-faint hover:text-loss transition-colors shrink-0"
                title="Remove row"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add row + Submit */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-xs text-action hover:text-action-hover transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Month
        </button>

        <div className="flex items-center gap-2">
          {overAllocated && (
            <span className="text-xs text-loss">Over by {(totalAllocated - remainingVolume).toLocaleString()} MT</span>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || overAllocated || totalAllocated === 0}
            className="rounded-md bg-action px-4 py-1.5 text-xs font-medium text-white hover:bg-action-hover disabled:opacity-40 transition-colors"
          >
            {submitting ? "Allocating..." : `Allocate ${totalAllocated.toLocaleString()} MT`}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-xs text-loss">{error}</div>
      )}
    </div>
  );
}
