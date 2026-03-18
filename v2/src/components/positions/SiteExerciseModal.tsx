"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { formatContractMonth } from "@/lib/commodity-utils";
import { API_BASE } from "@/lib/api";
import type { SitePositionHedge } from "@/types/positions";

interface SiteExerciseModalProps {
  allocation: SitePositionHedge;
  mode: "exercise" | "expire";
  onClose: () => void;
  onSuccess: () => void;
}

export function SiteExerciseModal({ allocation, mode, onClose, onSuccess }: SiteExerciseModalProps) {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tradeId = allocation.trade_id;
  if (!tradeId) return null;

  const isExercise = mode === "exercise";
  const title = isExercise ? "Exercise Option" : "Expire Option";
  const dateLabel = isExercise ? "Exercise Date" : "Expiry Date";
  const buttonLabel = isExercise ? "Exercise Option" : "Expire Option";
  const loadingLabel = isExercise ? "Exercising..." : "Expiring...";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = isExercise ? "exercise" : "expire";
      const body = isExercise
        ? { userId: user.id, exerciseDate: date }
        : { userId: user.id, expiryDate: date };

      const res = await fetch(`${API_BASE}/api/v1/position-manager/positions/${tradeId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Failed to ${mode} option`);
      }
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        <div className="rounded-md bg-surface px-3 py-2 text-sm">
          <div className="grid grid-cols-3 gap-2 text-muted">
            <div>Contract: <span className="text-secondary">{formatContractMonth(allocation.contract_month)}</span></div>
            <div>Volume: <span className="text-secondary">{Number(allocation.allocated_volume).toLocaleString()}</span></div>
            <div>Trade Price: <span className="text-secondary">{Number(allocation.trade_price)?.toFixed(2) ?? "—"}</span></div>
          </div>
        </div>

        {isExercise && (
          <div className="rounded-md border border-action-30 bg-action-5 p-3 text-sm text-secondary">
            Exercising this option will create a futures position at the strike price,
            inheriting the current site and budget month assignments.
          </div>
        )}

        {!isExercise && (
          <div className="rounded-md border border-destructive-15 bg-destructive-5 p-3 text-sm text-secondary">
            Expiring this option will close the position. No further actions will be possible.
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">{dateLabel}</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
          />
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
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              isExercise ? "bg-action hover:bg-action-hover" : "bg-destructive hover:bg-destructive/80"
            }`}
          >
            {submitting ? loadingLabel : buttonLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
