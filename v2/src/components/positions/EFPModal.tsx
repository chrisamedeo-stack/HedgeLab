"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { API_BASE } from "@/lib/api";
import { btnPrimary } from "@/lib/ui-classes";
import type { Position } from "@/types/positions";

interface PhysicalOption {
  id: string;
  contract_ref: string | null;
  site_name: string;
  delivery_month: string | null;
  volume: number;
  pricing_status: string;
}

interface EFPModalProps {
  position: Position | null;
  onSubmit: (params: {
    physicalContractId: string;
    efpBasis: number;
    efpDate: string;
    efpMarketPrice: number;
    volume?: number;
  }) => Promise<void>;
  onClose: () => void;
}

export function EFPModal({ position, onSubmit, onClose }: EFPModalProps) {
  const [physicals, setPhysicals] = useState<PhysicalOption[]>([]);
  const [physicalContractId, setPhysicalContractId] = useState("");
  const [efpBasis, setEfpBasis] = useState("");
  const [efpMarketPrice, setEfpMarketPrice] = useState("");
  const [efpDate, setEfpDate] = useState(new Date().toISOString().split("T")[0]);
  const [volume, setVolume] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;
    fetch(`${API_BASE}/api/v1/position-manager/physical-contracts?orgId=${position.org_id}&siteId=${position.site_id}&pricingStatus=unpriced`)
      .then((r) => r.json())
      .then(setPhysicals)
      .catch(() => {});
  }, [position]);

  if (!position) return null;

  const mktPrice = Number(efpMarketPrice);
  const basis = Number(efpBasis);
  const boardPrice = mktPrice + basis;
  const mult = position.direction === "long" ? 1 : -1;
  const vol = Number(volume) || position.total_volume;
  const pnlPreview = (mktPrice - position.trade_price) * vol * mult;

  const handleSubmit = async () => {
    if (!physicalContractId || !efpMarketPrice || efpBasis === "") return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        physicalContractId,
        efpBasis: basis,
        efpDate,
        efpMarketPrice: mktPrice,
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
    <Modal open={!!position} onClose={onClose} title="Execute EFP" width="max-w-xl">
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

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Physical Contract</label>
          <select
            value={physicalContractId}
            onChange={(e) => setPhysicalContractId(e.target.value)}
            className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
          >
            <option value="">— Select physical contract —</option>
            {physicals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.contract_ref ?? p.id.slice(0, 8)} — {p.site_name} — {p.delivery_month ?? "N/A"} — {p.volume.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Market Price</label>
            <input
              type="number" step="0.01" value={efpMarketPrice}
              onChange={(e) => setEfpMarketPrice(e.target.value)}
              className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Basis</label>
            <input
              type="number" step="0.01" value={efpBasis}
              onChange={(e) => setEfpBasis(e.target.value)}
              className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">EFP Date</label>
            <input
              type="date" value={efpDate}
              onChange={(e) => setEfpDate(e.target.value)}
              className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Volume (leave full for entire position)</label>
          <input
            type="number" value={volume} placeholder={String(position.total_volume)}
            onChange={(e) => setVolume(e.target.value)}
            className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
          />
        </div>

        {mktPrice > 0 && (
          <div className="rounded-md border border-b-default p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Board Price</span>
              <span className="font-medium text-primary">${boardPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Futures P&L</span>
              <span className={`font-medium ${pnlPreview >= 0 ? "text-profit" : "text-destructive"}`}>
                ${pnlPreview.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="text-sm text-muted hover:text-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !physicalContractId || !efpMarketPrice} className={btnPrimary}>
            {submitting ? "Executing..." : "Execute EFP"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
