"use client";

import { useState } from "react";
import { useBudgetStore } from "@/store/budgetStore";

interface BudgetLineFormProps {
  periodId: string;
  userId: string;
  onClose: () => void;
  existing?: {
    budgetMonth: string;
    budgetedVolume: number;
    budgetPrice: number | null;
    forecastVolume: number | null;
    forecastPrice: number | null;
    notes: string | null;
  };
}

export function BudgetLineForm({ periodId, userId, onClose, existing }: BudgetLineFormProps) {
  const { upsertLineItem } = useBudgetStore();
  const [form, setForm] = useState({
    budgetMonth: existing?.budgetMonth ?? "",
    budgetedVolume: existing?.budgetedVolume ?? 0,
    budgetPrice: existing?.budgetPrice ?? null as number | null,
    forecastVolume: existing?.forecastVolume ?? null as number | null,
    forecastPrice: existing?.forecastPrice ?? null as number | null,
    notes: existing?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.budgetMonth) { setError("Budget month is required"); return; }
    setSaving(true);
    setError(null);
    try {
      await upsertLineItem(periodId, { ...form, userId });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-muted">Budget Month</label>
        <input
          type="month"
          value={form.budgetMonth}
          onChange={(e) => setForm({ ...form, budgetMonth: e.target.value })}
          className={inputCls}
          disabled={!!existing}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted">Budgeted Volume (MT)</label>
          <input
            type="number"
            step="0.01"
            value={form.budgetedVolume}
            onChange={(e) => setForm({ ...form, budgetedVolume: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Budget Price</label>
          <input
            type="number"
            step="0.0001"
            value={form.budgetPrice ?? ""}
            onChange={(e) => setForm({ ...form, budgetPrice: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted">Forecast Volume (MT)</label>
          <input
            type="number"
            step="0.01"
            value={form.forecastVolume ?? ""}
            onChange={(e) => setForm({ ...form, forecastVolume: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Forecast Price</label>
          <input
            type="number"
            step="0.0001"
            value={form.forecastPrice ?? ""}
            onChange={(e) => setForm({ ...form, forecastPrice: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className={`${inputCls} h-16 resize-none`}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-faint hover:text-secondary transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : existing ? "Update" : "Add Month"}
        </button>
      </div>
    </form>
  );
}
