"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { btnPrimary } from "@/lib/ui-classes";
import type { Position } from "@/types/positions";

interface SplitRow {
  volume: string;
  siteId: string;
  budgetMonth: string;
}

interface SplitModalProps {
  position: Position | null;
  sites: { id: string; name: string; code: string }[];
  onSubmit: (params: { splits: { volume: number; siteId?: string; budgetMonth?: string }[] }) => Promise<void>;
  onClose: () => void;
}

export function SplitModal({ position, sites, onSubmit, onClose }: SplitModalProps) {
  const [rows, setRows] = useState<SplitRow[]>([
    { volume: "", siteId: "", budgetMonth: "" },
    { volume: "", siteId: "", budgetMonth: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!position) return null;

  const totalSplit = rows.reduce((s, r) => s + (Number(r.volume) || 0), 0);
  const remaining = position.total_volume - totalSplit;

  const updateRow = (idx: number, field: keyof SplitRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { volume: "", siteId: "", budgetMonth: "" }]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const splits = rows
      .filter((r) => Number(r.volume) > 0)
      .map((r) => ({
        volume: Number(r.volume),
        siteId: r.siteId || undefined,
        budgetMonth: r.budgetMonth || undefined,
      }));

    if (splits.length < 2) {
      setError("Need at least 2 split rows");
      return;
    }

    const total = splits.reduce((s, sp) => s + sp.volume, 0);
    if (Math.abs(total - position.total_volume) > 0.01) {
      setError(`Split volumes (${total}) must equal total volume (${position.total_volume})`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ splits });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!position} onClose={onClose} title="Split Position" width="max-w-2xl">
      <div className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="rounded-md bg-input-bg p-3 text-xs text-muted">
          <span className="font-medium text-secondary">{position.commodity_name}</span>
          {" · "}{position.contract_month}
          {" · Total Volume: "}<span className="font-medium text-primary">{Number(position.total_volume).toLocaleString()}</span>
        </div>

        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                {idx === 0 && <label className="block text-xs font-medium text-muted mb-1">Volume</label>}
                <input
                  type="number" value={row.volume} placeholder="Volume"
                  onChange={(e) => updateRow(idx, "volume", e.target.value)}
                  className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
                />
              </div>
              <div className="flex-1">
                {idx === 0 && <label className="block text-xs font-medium text-muted mb-1">Site (optional)</label>}
                <select
                  value={row.siteId}
                  onChange={(e) => updateRow(idx, "siteId", e.target.value)}
                  className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
                >
                  <option value="">—</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                {idx === 0 && <label className="block text-xs font-medium text-muted mb-1">Budget Month</label>}
                <input
                  type="month" value={row.budgetMonth}
                  onChange={(e) => updateRow(idx, "budgetMonth", e.target.value)}
                  className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
                />
              </div>
              {rows.length > 2 && (
                <button onClick={() => removeRow(idx)} className="pb-2 text-muted hover:text-destructive text-sm">
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addRow} className="text-xs text-action hover:underline">+ Add row</button>
          <span className={`text-xs font-medium ${Math.abs(remaining) < 0.01 ? "text-profit" : "text-warning"}`}>
            Remaining: {remaining.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="text-sm text-muted hover:text-secondary">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || Math.abs(remaining) > 0.01}
            className={btnPrimary}
          >
            {submitting ? "Splitting..." : "Split Position"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
