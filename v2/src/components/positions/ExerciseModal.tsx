"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { btnPrimary } from "@/lib/ui-classes";
import type { Position } from "@/types/positions";

interface ExerciseModalProps {
  position: Position | null;
  onSubmit: (params: { exerciseDate: string }) => Promise<void>;
  onClose: () => void;
}

export function ExerciseModal({ position, onSubmit, onClose }: ExerciseModalProps) {
  const [exerciseDate, setExerciseDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!position) return null;

  const childDirection = position.option_type === "call" ? "Long" : "Short";

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ exerciseDate });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!position} onClose={onClose} title="Exercise Option">
      <div className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="rounded-md bg-input-bg p-3 text-xs text-muted">
          <span className="font-medium text-secondary">{position.commodity_name}</span>
          {" · "}{position.option_type?.toUpperCase() ?? "Option"}
          {" · Strike: "}{Number(position.strike_price).toFixed(2)}
          {" · "}{position.contract_month}
          {" · Vol: "}{Number(position.total_volume).toLocaleString()}
        </div>

        <div className="rounded-md border border-action-30 bg-action-5 p-3 text-sm text-secondary">
          Exercising this option will create a <span className="font-medium">{childDirection}</span> futures
          position at the strike price of <span className="font-medium">${Number(position.strike_price).toFixed(2)}</span>,
          inheriting the current site, budget month, and hedge book assignments.
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Exercise Date</label>
          <input
            type="date" value={exerciseDate}
            onChange={(e) => setExerciseDate(e.target.value)}
            className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="text-sm text-muted hover:text-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className={btnPrimary}>
            {submitting ? "Exercising..." : "Exercise Option"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
