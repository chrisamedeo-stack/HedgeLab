"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePositionStore } from "@/store/positionStore";
import type { SitePositionHedge } from "@/types/positions";

const USER_ID = "00000000-0000-0000-0000-000000000099";

interface LockModalProps {
  allocation: SitePositionHedge;
  onClose: () => void;
  onSuccess: () => void;
}

export function LockModal({ allocation, onClose, onSuccess }: LockModalProps) {
  const { executeEFP } = usePositionStore();
  const [lockPrice, setLockPrice] = useState(allocation.trade_price?.toString() ?? "");
  const [basisPrice, setBasisPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirMult = allocation.direction === "short" ? -1 : 1;
  const price = Number(lockPrice);
  const projectedPnl =
    price && allocation.trade_price
      ? (price - Number(allocation.trade_price)) * Number(allocation.allocated_volume) * dirMult
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await executeEFP({
        userId: USER_ID,
        allocationId: allocation.id,
        lockPrice: Number(lockPrice),
        basisPrice: basisPrice ? Number(basisPrice) : undefined,
        deliveryMonth: allocation.contract_month ?? undefined,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Lock Price">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        <div className="rounded-md bg-surface px-3 py-2 text-sm">
          <div className="grid grid-cols-3 gap-2 text-muted">
            <div>Contract: <span className="text-secondary">{allocation.contract_month ?? "—"}</span></div>
            <div>Volume: <span className="text-secondary">{Number(allocation.allocated_volume).toLocaleString()}</span></div>
            <div>Trade Price: <span className="text-secondary">{Number(allocation.trade_price)?.toFixed(2) ?? "—"}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Lock Price *</span>
            <input
              type="number"
              required
              step="any"
              value={lockPrice}
              onChange={(e) => setLockPrice(e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-profit focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Basis</span>
            <input
              type="number"
              step="any"
              value={basisPrice}
              onChange={(e) => setBasisPrice(e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-profit focus:outline-none"
              placeholder="0.00"
            />
          </label>
        </div>

        {projectedPnl !== null && (
          <div className="rounded-md bg-surface px-3 py-2 text-sm">
            Projected Futures P&L:{" "}
            <span className={projectedPnl >= 0 ? "font-semibold text-profit" : "font-semibold text-loss"}>
              ${projectedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

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
            className="rounded-lg bg-profit px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-profit-hover disabled:opacity-50"
          >
            {submitting ? "Locking..." : "Lock Price"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
