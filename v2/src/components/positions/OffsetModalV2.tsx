"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Position } from "@/types/positions";

interface OffsetModalV2Props {
  position: Position | null;
  onSubmit: (params: { offsetPrice: number; offsetDate: string; volume?: number }) => Promise<void>;
  onClose: () => void;
}

export function OffsetModalV2({ position, onSubmit, onClose }: OffsetModalV2Props) {
  const [offsetPrice, setOffsetPrice] = useState("");
  const [offsetDate, setOffsetDate] = useState(new Date().toISOString().split("T")[0]);
  const [volume, setVolume] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!position) return null;

  const price = Number(offsetPrice);
  const mult = position.direction === "long" ? 1 : -1;
  const vol = Number(volume) || position.total_volume;
  const pnlPreview = price > 0 ? (price - position.trade_price) * vol * mult : null;

  const handleSubmit = async () => {
    if (!offsetPrice) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        offsetPrice: price,
        offsetDate,
        volume: vol < position.total_volume ? vol : undefined,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!position} onClose={onClose} title="Offset Position">
      <div className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="rounded-md bg-input-bg p-3 text-xs text-muted">
          <span className="font-medium text-secondary">{position.commodity_name}</span>
          {" · "}{position.direction === "long" ? "Long" : "Short"}
          {" · "}{position.contract_month}
          {" · Entry: "}{Number(position.trade_price).toFixed(2)}
          {" · Vol: "}{Number(position.total_volume).toLocaleString()}
          {position.site_name && <>{" · Site: "}{position.site_name}</>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Offset Price</label>
            <input
              type="number" step="0.01" value={offsetPrice}
              onChange={(e) => setOffsetPrice(e.target.value)}
              className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Offset Date</label>
            <input
              type="date" value={offsetDate}
              onChange={(e) => setOffsetDate(e.target.value)}
              className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Volume (optional — partial offset)</label>
          <input
            type="number" value={volume} placeholder={String(position.total_volume)}
            onChange={(e) => setVolume(e.target.value)}
            className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
          />
        </div>

        {pnlPreview != null && (
          <div className="rounded-md border border-b-default p-3 text-sm flex justify-between">
            <span className="text-muted">Realized P&L</span>
            <span className={`font-medium ${pnlPreview >= 0 ? "text-profit" : "text-destructive"}`}>
              ${pnlPreview.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="text-sm text-muted hover:text-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !offsetPrice} className="btnPrimary text-sm disabled:opacity-50">
            {submitting ? "Executing..." : "Offset"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
