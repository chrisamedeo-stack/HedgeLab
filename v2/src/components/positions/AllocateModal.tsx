"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Position } from "@/types/positions";

interface AllocateModalProps {
  position: Position | null;
  sites: { id: string; name: string; code: string }[];
  onSubmit: (params: { budgetMonth?: string; siteId?: string; volume?: number }) => Promise<void>;
  onClose: () => void;
}

export function AllocateModal({ position, sites, onSubmit, onClose }: AllocateModalProps) {
  const [budgetMonth, setBudgetMonth] = useState(position?.budget_month ?? "");
  const [siteId, setSiteId] = useState("");
  const [volume, setVolume] = useState(position?.total_volume?.toString() ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!position) return null;

  const isPartial = Number(volume) > 0 && Number(volume) < position.total_volume;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        budgetMonth: budgetMonth || undefined,
        siteId: siteId || undefined,
        volume: isPartial ? Number(volume) : undefined,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!position} onClose={onClose} title={isPartial ? "Allocate & Split" : "Allocate Position"}>
      <div className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="rounded-md bg-input-bg p-3 text-xs text-muted">
          <span className="font-medium text-secondary">{position.commodity_name}</span>
          {" · "}{position.direction === "long" ? "Long" : "Short"}
          {" · "}{position.contract_month}
          {" · Vol: "}{Number(position.total_volume).toLocaleString()}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Volume to Allocate</label>
          <input
            type="number"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            max={position.total_volume}
            min={1}
            className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
          />
          {isPartial && (
            <p className="mt-1 text-xs text-warning">
              Partial allocation — will split into {Number(volume).toLocaleString()} + {(position.total_volume - Number(volume)).toLocaleString()}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Budget Month</label>
          <input
            type="month"
            value={budgetMonth}
            onChange={(e) => setBudgetMonth(e.target.value)}
            className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Site</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
          >
            <option value="">— Select site —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="text-sm text-muted hover:text-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || (!budgetMonth && !siteId)} className="btnPrimary text-sm disabled:opacity-50">
            {submitting ? "Saving..." : isPartial ? "Allocate & Split" : "Allocate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
