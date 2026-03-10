"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useOrgContext } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePositionStore } from "@/store/positionStore";
import type { RolloverCandidate } from "@/types/positions";

interface RollFormProps {
  candidate: RolloverCandidate;
  onClose: () => void;
  onSuccess: () => void;
}

export function RollForm({ candidate, onClose, onSuccess }: RollFormProps) {
  const { orgId } = useOrgContext();
  const { executeRoll } = usePositionStore();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    closePrice: candidate.trade_price?.toString() ?? "",
    openPrice: "",
    openMonth: "",
    commission: "",
    fees: "",
    autoReallocate: true,
  });

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const spreadPrice = Number(form.closePrice) && Number(form.openPrice)
    ? Number(form.closePrice) - Number(form.openPrice)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await executeRoll({
        userId: user!.id,
        orgId,
        sourceAllocationId: candidate.id,
        closePrice: Number(form.closePrice),
        openPrice: Number(form.openPrice),
        openMonth: form.openMonth,
        commission: form.commission ? Number(form.commission) : undefined,
        fees: form.fees ? Number(form.fees) : undefined,
        autoReallocate: form.autoReallocate,
        reallocationSiteId: candidate.site_id,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Roll Position" width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        <div className="rounded-md bg-surface px-3 py-2 text-sm">
          <div className="grid grid-cols-2 gap-2 text-muted">
            <div>Site: <span className="text-secondary">{candidate.site_name}</span></div>
            <div>Commodity: <span className="text-secondary">{candidate.commodity_name}</span></div>
            <div>Current Month: <span className="text-secondary">{candidate.contract_month}</span></div>
            <div>Volume: <span className="text-secondary">{candidate.allocated_volume.toLocaleString()}</span></div>
            <div>Days to Last Trade: <span className={
              (candidate.days_to_last_trade ?? 99) <= 3 ? "font-bold text-loss" :
              (candidate.days_to_last_trade ?? 99) <= 7 ? "font-bold text-warning" :
              "text-secondary"
            }>{candidate.days_to_last_trade ?? "—"}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Close Price *</span>
            <input
              type="number"
              required
              step="any"
              value={form.closePrice}
              onChange={(e) => set("closePrice", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Open Price *</span>
            <input
              type="number"
              required
              step="any"
              value={form.openPrice}
              onChange={(e) => set("openPrice", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">New Month *</span>
            <input
              type="text"
              required
              value={form.openMonth}
              onChange={(e) => set("openMonth", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none"
              placeholder="H25"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Commission</span>
            <input
              type="number"
              step="any"
              value={form.commission}
              onChange={(e) => set("commission", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Fees</span>
            <input
              type="number"
              step="any"
              value={form.fees}
              onChange={(e) => set("fees", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none"
              placeholder="0.00"
            />
          </label>
        </div>

        {spreadPrice !== null && (
          <div className="rounded-md bg-surface px-3 py-2 text-sm">
            Spread: <span className={spreadPrice >= 0 ? "font-semibold text-profit" : "font-semibold text-loss"}>
              {spreadPrice.toFixed(4)}
            </span>
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.autoReallocate}
            onChange={(e) => set("autoReallocate", e.target.checked)}
            className="rounded border-b-input bg-input-bg text-accent focus:ring-accent"
          />
          <span className="text-sm text-secondary">Auto-reallocate to same site</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-b-input px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-40 disabled:opacity-50"
          >
            {submitting ? "Rolling..." : "Execute Roll"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
